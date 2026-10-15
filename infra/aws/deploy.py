#!/usr/bin/env python3
"""Rebuild Nexo in AWS Academy. Default is a read-only plan; --apply mutates cloud resources.

Run in the already authenticated AWS CloudShell. Secrets remain in a chmod-600 state
file and an SSM SecureString; never copy that state file into the repository.
"""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import secrets
import time
import zipfile
import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"
NAME = "nexo-academic"
TENANT = "21a4bbb2-fc48-4053-a98e-b805aa2306cc"
API_CLIENT = "0f2d7cee-cabb-4482-900d-64fb07f5f81d"
PARAMETER = "/nexo/academic/runtime"
STATE = Path(os.environ.get("NEXO_DEPLOY_STATE", str(Path.home() / ".nexo" / "deployment-state.json")))


def client(name):
    session_file = os.environ.get("NEXO_AWS_SESSION_FILE")
    if session_file:
        return boto3.Session(**json.loads(Path(session_file).read_text())).client(name)
    return boto3.client(name, region_name=REGION)


def save(state):
    STATE.parent.mkdir(mode=0o700, exist_ok=True)
    descriptor = os.open(STATE, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(state, output)


def plan():
    ec2, rds = client("ec2"), client("rds")
    print(json.dumps({
        "region": REGION,
        "account": client("sts").get_caller_identity()["Account"],
        "existingInstances": [i["InstanceId"] for r in ec2.describe_instances()["Reservations"]
                              for i in r["Instances"] if i["State"]["Name"] != "terminated"],
        "existingDatabases": [d["DBInstanceIdentifier"] for d in rds.describe_db_instances()["DBInstances"]],
        "proposed": {"ec2": "1 x t3.medium, encrypted gp3 30 GiB, LabInstanceProfile, IMDSv2",
                     "rds": "1 x db.t4g.micro PostgreSQL 17, private, encrypted gp2 20 GiB, Single-AZ",
                     "network": "HTTP/HTTPS public; no SSH, AMQP, management or PostgreSQL public ports",
                     "other": "1 Elastic IP, private S3 release bucket, SecureString, HTTP API and JWT Lambda authorizer",
                     "rabbitmq": "2 Docker nodes in one EC2; academic cluster, no host-level high availability"}}, indent=2))


def infrastructure(args, state):
    ec2, rds, s3, ssm = client("ec2"), client("rds"), client("s3"), client("ssm")
    account = client("sts").get_caller_identity()["Account"]
    state.setdefault("account", account)
    state.setdefault("bucket", f"{NAME}-release-{account}")
    state.setdefault("secrets", {k: secrets.token_hex(24) for k in
        ["POSTGRES_PASSWORD", "RABBITMQ_PASSWORD", "RABBITMQ_ERLANG_COOKIE", "NEXO_JWT_SECRET", "GATEWAY_ORIGIN_SECRET"]})
    save(state)
    bucket = state["bucket"]
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError:
        s3.create_bucket(Bucket=bucket)
    s3.put_public_access_block(Bucket=bucket, PublicAccessBlockConfiguration={
        "BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True})
    s3.put_bucket_encryption(Bucket=bucket, ServerSideEncryptionConfiguration={
        "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]})
    s3.upload_file(str(args.bundle), bucket, "nexo-source.zip")
    vpc = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"][0]["VpcId"]
    subnets = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc]}])["Subnets"]
    if "app_sg" not in state:
        state["app_sg"] = ec2.create_security_group(GroupName=NAME + "-app", Description="Nexo HTTPS and media ingress", VpcId=vpc)["GroupId"]
        save(state)
        ec2.authorize_security_group_ingress(GroupId=state["app_sg"], IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]} for p in [80, 443]])
    if "db_sg" not in state:
        state["db_sg"] = ec2.create_security_group(GroupName=NAME + "-db", Description="PostgreSQL from Nexo app only", VpcId=vpc)["GroupId"]
        save(state)
        ec2.authorize_security_group_ingress(GroupId=state["db_sg"], IpPermissions=[{
            "IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432,
            "UserIdGroupPairs": [{"GroupId": state["app_sg"]}]}])
    if "allocation" not in state:
        ip = ec2.allocate_address(Domain="vpc")
        state.update(allocation=ip["AllocationId"], ip=ip["PublicIp"])
        save(state)
    state["frontend"] = f"https://{state['ip']}.nip.io"
    state["origin"] = f"https://origin.{state['ip']}.nip.io"
    if "database" not in state:
        try:
            rds.create_db_subnet_group(DBSubnetGroupName=NAME, DBSubnetGroupDescription="Nexo private database",
                                      SubnetIds=[s["SubnetId"] for s in subnets])
        except rds.exceptions.DBSubnetGroupAlreadyExistsFault:
            pass
        versions = rds.describe_db_engine_versions(Engine="postgres", EngineVersion="17", IncludeAll=False)["DBEngineVersions"]
        if not versions:
            versions = [v for v in rds.describe_db_engine_versions(Engine="postgres")["DBEngineVersions"] if v["EngineVersion"].startswith("17.")]
        version = max(versions, key=lambda v: tuple(int(p) for p in v["EngineVersion"].split(".")))
        rds.create_db_instance(DBInstanceIdentifier=NAME, DBName="nexo", Engine="postgres",
            EngineVersion=version["EngineVersion"], DBInstanceClass="db.t4g.micro", AllocatedStorage=20,
            StorageType="gp2", StorageEncrypted=True, MasterUsername="nexo_admin",
            MasterUserPassword=state["secrets"]["POSTGRES_PASSWORD"], VpcSecurityGroupIds=[state["db_sg"]],
            DBSubnetGroupName=NAME, PubliclyAccessible=False, MultiAZ=False, BackupRetentionPeriod=1,
            EnablePerformanceInsights=False, MonitoringInterval=0, AutoMinorVersionUpgrade=True,
            Tags=[{"Key": "Project", "Value": "Nexo"}])
        state["database"] = NAME
        save(state)
    if "instance" not in state:
        ami = ssm.get_parameter(Name="/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64")["Parameter"]["Value"]
        user_data = f"""#!/bin/bash
set -euo pipefail
dnf install -y docker python3 unzip
systemctl enable --now docker
mkdir -p /usr/local/lib/docker/cli-plugins /opt/nexo
for i in $(seq 1 180); do
  if aws ssm get-parameter --region {REGION} --name {PARAMETER} --with-decryption --query Parameter.Value --output text > /opt/nexo/runtime.json 2>/dev/null; then break; fi
  sleep 10
done
chmod 600 /opt/nexo/runtime.json
aws s3 cp s3://{bucket}/nexo-source.zip /opt/nexo/source.zip --region {REGION}
cd /opt/nexo
unzip -q -o source.zip
sh infra/aws/install-build-tools.sh
python3 infra/aws/write_env.py runtime.json .env
export COMPOSE_PARALLEL_LIMIT=1
for service in backend event-worker rabbit-admin web; do docker compose -f compose.platform.yml --profile web --profile media build $service; done
docker compose -f compose.platform.yml --profile web --profile media up -d
"""
        instance = ec2.run_instances(ImageId=ami, InstanceType="t3.medium", MinCount=1, MaxCount=1,
            IamInstanceProfile={"Name": "LabInstanceProfile"}, SecurityGroupIds=[state["app_sg"]],
            SubnetId=subnets[0]["SubnetId"], MetadataOptions={"HttpTokens": "required", "HttpEndpoint": "enabled"},
            BlockDeviceMappings=[{"DeviceName": "/dev/xvda", "Ebs": {"VolumeSize": 30, "VolumeType": "gp3", "Encrypted": True, "DeleteOnTermination": True}}],
            CreditSpecification={"CpuCredits": "standard"}, UserData=user_data,
            TagSpecifications=[{"ResourceType": "instance", "Tags": [{"Key": "Name", "Value": NAME}, {"Key": "Project", "Value": "Nexo"}]}])["Instances"][0]
        state["instance"] = instance["InstanceId"]
        save(state)
    ec2.get_waiter("instance_running").wait(InstanceIds=[state["instance"]])
    ec2.associate_address(InstanceId=state["instance"], AllocationId=state["allocation"])
    print("EC2 running; waiting for PostgreSQL availability", flush=True)
    rds.get_waiter("db_instance_available").wait(DBInstanceIdentifier=NAME, WaiterConfig={"Delay": 30, "MaxAttempts": 60})
    database = rds.describe_db_instances(DBInstanceIdentifier=NAME)["DBInstances"][0]
    env = {**state["secrets"], "SPRING_DATASOURCE_URL": f"jdbc:postgresql://{database['Endpoint']['Address']}:5432/nexo?sslmode=require",
        "SPRING_DATASOURCE_USERNAME": "nexo_admin", "FRONTEND_ORIGIN": state["frontend"],
        "FRONTEND_HOST": state["frontend"].removeprefix("https://"),
        "BACKEND_HOST": state["origin"].removeprefix("https://"), "NEXO_ADMIN_OBJECT_IDS": args.admin_object_id or "",
        "API_UPSTREAM": "backend:8080"}
    state["runtime"] = env
    configure_media(state, env)
    ssm.put_parameter(Name=PARAMETER, Type="SecureString", Value=json.dumps(env), Overwrite=True)
    save(state)
    print(json.dumps({"instance": state["instance"], "frontend": state["frontend"], "origin": state["origin"], "database": NAME}))


def configure_media(state, env):
    for key in ["LIVEKIT_API_SECRET", "NEXO_TURN_SECRET"]:
        state["secrets"].setdefault(key, secrets.token_hex(24))
        env[key] = state["secrets"][key]
    ec2 = client("ec2")
    instance = ec2.describe_instances(InstanceIds=[state["instance"]])["Reservations"][0]["Instances"][0]
    turn_private_ip = instance["PrivateIpAddress"]
    env.update(PUBLIC_IP=state["ip"], MEDIA_HOST=f"media.{state['ip']}.nip.io",
        TURN_PRIVATE_IP=turn_private_ip,
        LIVEKIT_PUBLIC_URL=f"wss://media.{state['ip']}.nip.io", LIVEKIT_API_KEY="nexo-livekit",
        NEXO_BROADCASTS_ENABLED="true", NEXO_TURN_URL=(
            f"turn:{state['ip']}:3478?transport=udp,turn:{state['ip']}:3478?transport=tcp"))
    for protocol, start, end in [("tcp", 7881, 7881), ("udp", 7882, 7882),
                                  ("udp", 3478, 3478), ("tcp", 3478, 3478),
                                  ("udp", 49160, 49200)]:
        try:
            ec2.authorize_security_group_ingress(GroupId=state["app_sg"], IpPermissions=[{
                "IpProtocol": protocol, "FromPort": start, "ToPort": end,
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Authenticated Nexo WebRTC media"}]}])
        except ClientError as error:
            if error.response["Error"]["Code"] != "InvalidPermission.Duplicate": raise


def gateway(state):
    api, functions, ssm = client("apigatewayv2"), client("lambda"), client("ssm")
    code = io.BytesIO()
    with zipfile.ZipFile(code, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("index.mjs", (Path(__file__).parent / "authorizer.mjs").read_text())
    function_name = NAME + "-jwt"
    role = f"arn:aws:iam::{state['account']}:role/LabRole"
    variables = {"NEXO_JWT_SECRET": state["secrets"]["NEXO_JWT_SECRET"], "AZURE_API_CLIENT_ID": API_CLIENT}
    try:
        function = functions.create_function(FunctionName=function_name, Runtime="nodejs22.x", Role=role,
            Handler="index.handler", Code={"ZipFile": code.getvalue()}, Timeout=10, MemorySize=128,
            Environment={"Variables": variables})
    except functions.exceptions.ResourceConflictException:
        functions.update_function_code(FunctionName=function_name, ZipFile=code.getvalue())
        functions.get_waiter("function_updated_v2").wait(FunctionName=function_name)
        function = functions.update_function_configuration(FunctionName=function_name, Environment={"Variables": variables})
    functions.get_waiter("function_active_v2").wait(FunctionName=function_name)
    if "api" not in state:
        result = api.create_api(Name=NAME, ProtocolType="HTTP", CorsConfiguration={"AllowOrigins": [state["frontend"]],
            "AllowHeaders": ["Authorization", "Content-Type"], "AllowMethods": ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]})
        state.update(api=result["ApiId"], gateway=result["ApiEndpoint"])
        save(state)
    try:
        functions.add_permission(FunctionName=function_name, StatementId=NAME + "-gateway-" + state["api"], Action="lambda:InvokeFunction",
            Principal="apigateway.amazonaws.com", SourceArn=f"arn:aws:execute-api:{REGION}:{state['account']}:{state['api']}/authorizers/*")
    except functions.exceptions.ResourceConflictException:
        pass
    existing_authorizers = api.get_authorizers(ApiId=state["api"]).get("Items", [])
    authorizer = next((a for a in existing_authorizers if a["Name"] == "Nexo-JWT-validation"), None)
    if authorizer is None:
        authorizer = api.create_authorizer(ApiId=state["api"], Name="Nexo-JWT-validation", AuthorizerType="REQUEST",
            AuthorizerUri=f"arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{function['FunctionArn']}/invocations",
            IdentitySource=["$request.header.Authorization"], AuthorizerPayloadFormatVersion="2.0",
            EnableSimpleResponses=True, AuthorizerResultTtlInSeconds=0)
    existing_integrations = api.get_integrations(ApiId=state["api"]).get("Items", [])
    integration = next((i for i in existing_integrations if i.get("IntegrationUri") == state["origin"]), None)
    origin_request_parameters = {
        "overwrite:header.x-nexo-origin": state["secrets"]["GATEWAY_ORIGIN_SECRET"],
        "overwrite:path": "$request.path",
    }
    if integration is None:
        integration = api.create_integration(ApiId=state["api"], IntegrationType="HTTP_PROXY", IntegrationMethod="ANY",
            IntegrationUri=state["origin"], PayloadFormatVersion="1.0",
            RequestParameters=origin_request_parameters)
    elif integration.get("RequestParameters") != origin_request_parameters:
        integration = api.update_integration(ApiId=state["api"], IntegrationId=integration["IntegrationId"],
            RequestParameters=origin_request_parameters)
    routes = {r["RouteKey"] for r in api.get_routes(ApiId=state["api"]).get("Items", [])}
    for route in ["ANY /api/{proxy+}"]:
        if route not in routes:
            api.create_route(ApiId=state["api"], RouteKey=route, Target="integrations/" + integration["IntegrationId"],
                AuthorizationType="CUSTOM", AuthorizerId=authorizer["AuthorizerId"])
    for route in ["GET /api/public/health", "POST /api/auth/login", "POST /api/auth/register", "GET /api/avatars/{proxy+}", "OPTIONS /{proxy+}"]:
        if route not in routes:
            api.create_route(ApiId=state["api"], RouteKey=route, Target="integrations/" + integration["IntegrationId"], AuthorizationType="NONE")
    if not any(s["StageName"] == "$default" for s in api.get_stages(ApiId=state["api"]).get("Items", [])):
        api.create_stage(ApiId=state["api"], StageName="$default", AutoDeploy=True,
            DefaultRouteSettings={"ThrottlingBurstLimit": 100, "ThrottlingRateLimit": 50.0})
    state["runtime"]["API_UPSTREAM"] = state["gateway"]
    ssm.put_parameter(Name=PARAMETER, Type="SecureString", Value=json.dumps(state["runtime"]), Overwrite=True)
    save(state)
    command = client("ssm").send_command(InstanceIds=[state["instance"]], DocumentName="AWS-RunShellScript",
        Parameters={"commands": ["cloud-init status --wait >/dev/null 2>&1 || true", f"aws ssm get-parameter --region {REGION} --name {PARAMETER} --with-decryption --query Parameter.Value --output text > /opt/nexo/runtime.json",
            "cd /opt/nexo && python3 infra/aws/write_env.py runtime.json .env && docker compose -f compose.platform.yml --profile web up -d web"]})
    print(json.dumps({"gateway": state["gateway"], "frontend": state["frontend"], "refreshCommand": command["Command"]["CommandId"]}))


def release(args, state):
    """Refresh source and media without recreating EC2/RDS or resetting the gateway."""
    env = state["runtime"]
    configure_media(state, env)
    if args.admin_object_id:
        env["NEXO_ADMIN_OBJECT_IDS"] = args.admin_object_id
    client("s3").upload_file(str(args.bundle), state["bucket"], "nexo-source.zip")
    client("ssm").put_parameter(Name=PARAMETER, Type="SecureString", Value=json.dumps(env), Overwrite=True)
    save(state)
    commands = ["set -eu", "cloud-init status --wait >/dev/null 2>&1 || true", "cd /opt/nexo",
        f"aws s3 cp s3://{state['bucket']}/nexo-source.zip source.zip --region {REGION}",
        "unzip -q -o source.zip", "sh infra/aws/install-build-tools.sh",
        f"aws ssm get-parameter --region {REGION} --name {PARAMETER} --with-decryption --query Parameter.Value --output text > runtime.json",
        "chmod 600 runtime.json", "python3 infra/aws/write_env.py runtime.json .env",
        "export COMPOSE_PARALLEL_LIMIT=1",
        "for service in backend event-worker rabbit-admin web; do docker compose -f compose.platform.yml --profile web --profile media build $service; done",
        "docker compose -f compose.platform.yml --profile web --profile media up -d --no-build",
        "docker compose -f compose.platform.yml --profile web --profile media ps"]
    result = client("ssm").send_command(InstanceIds=[state["instance"]], DocumentName="AWS-RunShellScript",
        TimeoutSeconds=3600, Parameters={"commands": commands, "executionTimeout": ["3600"]})
    state["release_command"] = result["Command"]["CommandId"]
    save(state)
    print(json.dumps({"releaseCommand": state["release_command"], "frontend": state["frontend"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--stage", choices=["infrastructure", "gateway", "release"], default="infrastructure")
    parser.add_argument("--bundle", type=Path, default=Path("nexo-source.zip"))
    parser.add_argument("--admin-object-id", default="")
    args = parser.parse_args()
    if not args.apply:
        plan(); return
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    if args.stage == "infrastructure":
        if not args.bundle.is_file(): parser.error("Bundle does not exist")
        infrastructure(args, state)
    elif args.stage == "release":
        if not args.bundle.is_file(): parser.error("Bundle does not exist")
        release(args, state)
    else:
        gateway(state)


if __name__ == "__main__":
    main()
