#!/usr/bin/env python3
"""Read-only infrastructure evidence. Never prints runtime configuration or credentials."""
import json
from pathlib import Path
from deploy import STATE, client


def main():
    state = json.loads(STATE.read_text())
    ec2, rds, api = client("ec2"), client("rds"), client("apigatewayv2")
    instance = ec2.describe_instances(InstanceIds=[state["instance"]])["Reservations"][0]["Instances"][0]
    database = rds.describe_db_instances(DBInstanceIdentifier=state["database"])["DBInstances"][0]
    groups = ec2.describe_security_groups(GroupIds=[state["app_sg"], state["db_sg"]])["SecurityGroups"]
    result = {
        "instance": {"id": instance["InstanceId"], "state": instance["State"]["Name"],
                     "type": instance["InstanceType"], "imdsV2Required": instance["MetadataOptions"]["HttpTokens"] == "required"},
        "database": {"id": database["DBInstanceIdentifier"], "state": database["DBInstanceStatus"],
                     "engine": database["Engine"], "version": database["EngineVersion"],
                     "public": database["PubliclyAccessible"], "encrypted": database["StorageEncrypted"]},
        "network": [{"name": group["GroupName"], "ingress": group["IpPermissions"]} for group in groups],
        "frontend": state["frontend"], "gateway": state.get("gateway"),
        "routes": [{"route": route["RouteKey"], "authorization": route["AuthorizationType"]}
                   for route in api.get_routes(ApiId=state["api"]).get("Items", [])] if state.get("api") else []}
    assert not result["database"]["public"] and result["database"]["encrypted"]
    assert result["instance"]["imdsV2Required"]
    Path(".tmp").mkdir(exist_ok=True)
    Path(".tmp/cloud-infrastructure.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
