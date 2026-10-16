#!/usr/bin/env python3
"""Plan or deploy authenticated Nexo messaging/monitoring services in AWS Academy.

Default mode is read-only. Run from the repository in AWS CloudShell and use
--apply only after reviewing plan output. Secrets are kept in SSM SecureString.
"""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import secrets
import tarfile

from botocore.exceptions import ClientError
from deploy import PARAMETER, REGION, STATE, client, save

OBS_NAME = "nexo-observability"
AUTH_PARAMETER = "/nexo/observability/auth"
OBS_STATE = Path.home() / ".nexo" / "observability-state.json"
SOURCE = Path(__file__).resolve().parents[1] / "observability"


def load_obs():
    return json.loads(OBS_STATE.read_text()) if OBS_STATE.exists() else {}


def save_obs(state):
    OBS_STATE.parent.mkdir(mode=0o700, exist_ok=True)
    fd = os.open(OBS_STATE, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump(state, output)


def app_instance(ec2):
    deployment = json.loads(STATE.read_text())
    app = ec2.describe_instances(InstanceIds=[deployment["instance"]])["Reservations"][0]["Instances"][0]
    return deployment, app


def plan():
    ec2 = client("ec2")
    deployment, app = app_instance(ec2)
    print(json.dumps({
        "region": REGION,
        "application": {"id": app["InstanceId"], "state": app["State"]["Name"],
                        "type": app["InstanceType"], "privateIp": app["PrivateIpAddress"],
                        "securityGroup": deployment["app_sg"]},
        "existingObservability": load_obs(),
        "planned": {
            "ec2": "1 x t3.large, encrypted gp3 40 GiB, LabInstanceProfile, IMDSv2",
            "services": ["Apache Kafka 4.2.2 (KRaft single broker)", "Kafbat UI 1.5.0",
                         "Prometheus 3.15.0", "Grafana 13.2.2", "RabbitMQ Management proxy"],
            "publicIngress": "80/443 only; Caddy HTTPS + shared basic auth; no SSH",
            "privateIngress": "Kafka TCP 9092 from Nexo app SG only",
            "appIngress": "15672/15692/15693 from observability SG only",
            "events": "RabbitMQ -> Kafka nexo.messages.v1 -> nexo-analytics; event ID/type/time only",
            "credentialParameter": AUTH_PARAMETER,
        },
    }, indent=2))


def package_assets():
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode="w:gz") as archive:
        for path in sorted(SOURCE.rglob("*")):
            if path.is_file():
                archive.add(path, arcname=path.relative_to(SOURCE))
    return base64.b64encode(payload.getvalue()).decode("ascii")


BOOTSTRAP = r'''#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/nexo-observability-bootstrap.log | logger -t nexo-observability -s 2>/dev/console) 2>&1
REGION=us-east-1
APP_PRIVATE_IP=__APP_PRIVATE_IP__
PUBLIC_IP=__PUBLIC_IP__
ASSET_B64=__ASSET_B64__
dnf install -y docker awscli-2 jq python3 tar gzip
systemctl enable --now docker
mkdir -p /opt/nexo-observability /usr/local/lib/docker/cli-plugins
printf '%s' "$ASSET_B64" | base64 -d | tar -xz -C /opt/nexo-observability
unset ASSET_B64
sed -i "s|\${APP_PRIVATE_IP}|${APP_PRIVATE_IP}|g" /opt/nexo-observability/prometheus.yml
tmp=$(mktemp -d)
cd "$tmp"
curl -fsSLO https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64.sha256 -o docker-compose.sha256
expected=$(cut -d ' ' -f 1 docker-compose.sha256)
printf '%s  %s\n' "$expected" docker-compose-linux-x86_64 | sha256sum -c -
install -m 755 docker-compose-linux-x86_64 /usr/local/lib/docker/cli-plugins/docker-compose
cd / && rm -rf "$tmp"
aws ssm get-parameter --region "$REGION" --name /nexo/academic/runtime --with-decryption --query Parameter.Value --output text > /root/nexo-runtime.json
chmod 600 /root/nexo-runtime.json
token=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')
OBS_PRIVATE_IP=$(curl -fsS -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/local-ipv4)
export APP_PRIVATE_IP OBS_PRIVATE_IP PUBLIC_IP
python3 - <<'PY'
import base64, json, os, subprocess
runtime=json.load(open('/root/nexo-runtime.json'))
auth={'username':runtime['OBSERVABILITY_USERNAME'],'password':runtime['OBSERVABILITY_PASSWORD']}
hashed=subprocess.run(['docker','run','--rm','caddy:2.10.2-alpine','caddy','hash-password','--plaintext',auth['password']],check=True,capture_output=True,text=True).stdout.strip()
cluster=subprocess.check_output(['docker','run','--rm','apache/kafka:4.2.2','/opt/kafka/bin/kafka-storage.sh','random-uuid'],text=True).strip()
env={'KAFKA_CLUSTER_ID':cluster,'KAFKA_ADVERTISED_HOST':os.environ['OBS_PRIVATE_IP'],
     'OBS_DOMAIN':os.environ['PUBLIC_IP']+'.nip.io','OBS_USERNAME':auth['username'],
     'OBS_PASSWORD':auth['password'],'OBS_PASSWORD_HASH':hashed,'APP_PRIVATE_IP':os.environ['APP_PRIVATE_IP'],
     }
with open('/opt/nexo-observability/.env','w') as f:
    for key,value in env.items():
        if '\n' in str(value) or '\r' in str(value): raise SystemExit('Invalid environment value')
        if key == 'OBS_PASSWORD_HASH': f.write(f"{key}='{value}'\n")
        else: f.write(f'{key}={value}\n')
os.chmod('/opt/nexo-observability/.env',0o600)
PY
rm -f /root/nexo-runtime.json
cd /opt/nexo-observability
docker compose -f compose.yml up -d
'''


def make_user_data(app_private_ip, public_ip):
    return BOOTSTRAP.replace("__APP_PRIVATE_IP__", app_private_ip).replace("__PUBLIC_IP__", public_ip).replace("__ASSET_B64__", package_assets())


def ensure_ingress(ec2, group_id, permission):
    try:
        ec2.authorize_security_group_ingress(GroupId=group_id, IpPermissions=[permission])
    except ClientError as error:
        if error.response["Error"]["Code"] != "InvalidPermission.Duplicate":
            raise


def apply(bundle):
    if not bundle.is_file():
        raise SystemExit(f"Source bundle does not exist: {bundle}")
    ec2, ssm, s3 = client("ec2"), client("ssm"), client("s3")
    deployment, app = app_instance(ec2)
    obs = load_obs()
    vpc_id, app_private_ip = app["VpcId"], app["PrivateIpAddress"]

    try:
        auth = json.loads(ssm.get_parameter(Name=AUTH_PARAMETER, WithDecryption=True)["Parameter"]["Value"])
    except ssm.exceptions.ParameterNotFound:
        auth = {"username": "nexo-viewer", "password": secrets.token_urlsafe(28)}
        ssm.put_parameter(Name=AUTH_PARAMETER, Type="SecureString", Value=json.dumps(auth))

    # Reuse the existing secure runtime parameter, which the lab instance
    # profile already reads, rather than relying on a new SSM permission.
    deployment["runtime"]["OBSERVABILITY_USERNAME"] = auth["username"]
    deployment["runtime"]["OBSERVABILITY_PASSWORD"] = auth["password"]
    deployment["runtime"]["RABBITMQ_MONITORING_USER"] = auth["username"]
    deployment["runtime"]["RABBITMQ_MONITORING_PASSWORD"] = auth["password"]
    ssm.put_parameter(Name=PARAMETER, Type="SecureString", Value=json.dumps(deployment["runtime"]), Overwrite=True)
    save(deployment)

    if not obs.get("security_group"):
        groups = ec2.describe_security_groups(Filters=[{"Name": "vpc-id", "Values": [vpc_id]},
            {"Name": "group-name", "Values": [OBS_NAME]}])["SecurityGroups"]
        obs["security_group"] = groups[0]["GroupId"] if groups else ec2.create_security_group(
            GroupName=OBS_NAME, Description="Nexo HTTPS dashboards and private messaging", VpcId=vpc_id)["GroupId"]
        save_obs(obs)
    obs_sg = obs["security_group"]
    for port in (80, 443):
        ensure_ingress(ec2, obs_sg, {"IpProtocol": "tcp", "FromPort": port, "ToPort": port,
            "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Authenticated HTTPS dashboard gateway"}]})
    ensure_ingress(ec2, obs_sg, {"IpProtocol": "tcp", "FromPort": 9092, "ToPort": 9092,
        "UserIdGroupPairs": [{"GroupId": deployment["app_sg"], "Description": "Nexo app to Kafka"}]})
    for port in (15672, 15692, 15693):
        ensure_ingress(ec2, deployment["app_sg"], {"IpProtocol": "tcp", "FromPort": port, "ToPort": port,
            "UserIdGroupPairs": [{"GroupId": obs_sg, "Description": "Private observability access"}]})

    subnets = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])["Subnets"]
    subnet = next((s for s in subnets if s["SubnetId"] == app["SubnetId"] and s.get("MapPublicIpOnLaunch")), None)
    if not subnet:
        subnet = next((s for s in subnets if s.get("MapPublicIpOnLaunch")), None)
    if not subnet:
        raise RuntimeError("The app VPC has no subnet with automatic public IPv4")
    if not obs.get("allocation"):
        address = ec2.allocate_address(Domain="vpc", TagSpecifications=[{"ResourceType": "elastic-ip",
            "Tags": [{"Key": "Name", "Value": OBS_NAME}, {"Key": "Project", "Value": "Nexo"}]}])
        obs.update(allocation=address["AllocationId"], public_ip=address["PublicIp"])
        save_obs(obs)

    if not obs.get("instance"):
        found = ec2.describe_instances(Filters=[{"Name": "tag:Name", "Values": [OBS_NAME]},
            {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]}])["Reservations"]
        if found:
            obs["instance"] = found[0]["Instances"][0]["InstanceId"]
        else:
            ami = client("ssm").get_parameter(Name="/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64")["Parameter"]["Value"]
            launched = ec2.run_instances(
                ImageId=ami, InstanceType="t3.large", MinCount=1, MaxCount=1,
                IamInstanceProfile={"Name": "LabInstanceProfile"}, SecurityGroupIds=[obs_sg], SubnetId=subnet["SubnetId"],
                MetadataOptions={"HttpTokens": "required", "HttpEndpoint": "enabled"},
                BlockDeviceMappings=[{"DeviceName": "/dev/xvda", "Ebs": {"VolumeSize": 40, "VolumeType": "gp3", "Encrypted": True, "DeleteOnTermination": True}}],
                CreditSpecification={"CpuCredits": "standard"}, UserData=make_user_data(app_private_ip, obs["public_ip"]),
                TagSpecifications=[{"ResourceType": "instance", "Tags": [{"Key": "Name", "Value": OBS_NAME}, {"Key": "Project", "Value": "Nexo"}]}],
            )
            obs["instance"] = launched["Instances"][0]["InstanceId"]
        save_obs(obs)

    ec2.get_waiter("instance_running").wait(InstanceIds=[obs["instance"]])
    instance = ec2.describe_instances(InstanceIds=[obs["instance"]])["Reservations"][0]["Instances"][0]
    eip = ec2.describe_addresses(AllocationIds=[obs["allocation"]])["Addresses"][0]
    if not eip.get("AssociationId"):
        ec2.associate_address(InstanceId=obs["instance"], AllocationId=obs["allocation"])

    deployment["runtime"]["KAFKA_BOOTSTRAP_SERVERS"] = f"{instance['PrivateIpAddress']}:9092"
    ssm.put_parameter(Name=PARAMETER, Type="SecureString", Value=json.dumps(deployment["runtime"]), Overwrite=True)
    save(deployment)
    s3.upload_file(str(bundle), deployment["bucket"], "nexo-source.zip")

    # EC2 user data only runs at first launch. Refresh an existing host from
    # this release as well so compose changes in Git reach Grafana and peers.
    refresh_obs = [
        "set -eu",
        f"aws s3 cp s3://{deployment['bucket']}/nexo-source.zip /opt/nexo-observability/source.zip --region {REGION}",
        "mkdir -p /tmp/nexo-observability-source",
        "unzip -oq /opt/nexo-observability/source.zip 'infra/observability/*' -d /tmp/nexo-observability-source",
        "cp -a /tmp/nexo-observability-source/infra/observability/. /opt/nexo-observability/",
        "rm -rf /tmp/nexo-observability-source /opt/nexo-observability/source.zip",
        "cd /opt/nexo-observability",
        "APP_PRIVATE_IP=$(sed -n 's/^APP_PRIVATE_IP=//p' .env)",
        'sed -i "s|\\${APP_PRIVATE_IP}|${APP_PRIVATE_IP}|g" prometheus.yml',
        "docker compose up -d",
        "docker compose ps",
    ]
    refresh = ssm.send_command(InstanceIds=[obs["instance"]], DocumentName="AWS-RunShellScript",
        TimeoutSeconds=600, Parameters={"commands": refresh_obs, "executionTimeout": ["600"]})
    obs["refresh_command"] = refresh["Command"]["CommandId"]
    save_obs(obs)

    setup_rabbit_user = r'''set -eu
OBS_USER=$(python3 -c 'import json; print(json.load(open("/opt/nexo/runtime.json"))["RABBITMQ_MONITORING_USER"])')
OBS_PASS=$(python3 -c 'import json; print(json.load(open("/opt/nexo/runtime.json"))["RABBITMQ_MONITORING_PASSWORD"])')
for attempt in $(seq 1 60); do
  if docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmq-diagnostics -q ping >/dev/null 2>&1; then break; fi
  sleep 5
done
if docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmqctl list_users 2>/dev/null | awk -v user="$OBS_USER" '$1 == user { found=1 } END { exit !found }'; then
  docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmqctl change_password "$OBS_USER" "$OBS_PASS"
else
  docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmqctl add_user "$OBS_USER" "$OBS_PASS"
fi
docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmqctl set_user_tags "$OBS_USER" monitoring
docker compose -f /opt/nexo/compose.platform.yml exec -T rabbitmq1 rabbitmqctl set_permissions -p / "$OBS_USER" "" "" ".*"
unset OBS_PASS
'''
    deploy_app = [
        "set -eu", "cloud-init status --wait >/dev/null 2>&1 || true",
        f"aws ssm get-parameter --region {REGION} --name {PARAMETER} --with-decryption --query Parameter.Value --output text > /opt/nexo/runtime.json",
        "chmod 600 /opt/nexo/runtime.json", setup_rabbit_user,
        f"aws s3 cp s3://{deployment['bucket']}/nexo-source.zip /opt/nexo/source.zip --region {REGION}",
        "cd /opt/nexo && unzip -q -o source.zip && sh infra/aws/install-build-tools.sh",
        f"aws ssm get-parameter --region {REGION} --name {PARAMETER} --with-decryption --query Parameter.Value --output text > /opt/nexo/runtime.json",
        "cd /opt/nexo && chmod 600 runtime.json && python3 infra/aws/write_env.py runtime.json .env",
        "cd /opt/nexo && export COMPOSE_PARALLEL_LIMIT=1 && for service in backend event-worker rabbit-admin web; do docker compose -f compose.platform.yml --profile web --profile media build $service; done",
        "cd /opt/nexo && docker compose -f compose.platform.yml --profile web --profile media --profile kafka build event-bridge analytics-consumer",
        "cd /opt/nexo && docker compose -f compose.platform.yml --profile web --profile media --profile kafka up -d --no-build",
        "cd /opt/nexo && docker compose -f compose.platform.yml --profile web --profile media --profile kafka ps",
    ]
    command = client("ssm").send_command(InstanceIds=[deployment["instance"]], DocumentName="AWS-RunShellScript",
        TimeoutSeconds=3600, Parameters={"commands": deploy_app, "executionTimeout": ["3600"]})
    obs.update(app_private_ip=app_private_ip, private_ip=instance["PrivateIpAddress"], public_ip=obs["public_ip"],
               app_release_command=command["Command"]["CommandId"])
    save_obs(obs)
    print(json.dumps({
        "instance": obs["instance"], "state": instance["State"]["Name"], "privateIp": instance["PrivateIpAddress"],
        "elasticIp": obs["public_ip"],
        "urls": {name: f"https://{name}.{obs['public_ip']}.nip.io" for name in ["rabbit", "kafka", "grafana"]},
        "appReleaseCommand": obs["app_release_command"], "observabilityRefreshCommand": obs["refresh_command"],
        "credentialParameter": AUTH_PARAMETER,
        "note": "Retrieve the username and password from the SSM SecureString; they are not printed.",
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Create and deploy the observability stack")
    parser.add_argument("--bundle", type=Path, default=Path(".tmp/nexo-source.zip"))
    args = parser.parse_args()
    if args.apply:
        apply(args.bundle)
    else:
        plan()


if __name__ == "__main__":
    main()
