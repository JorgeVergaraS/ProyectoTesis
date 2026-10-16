#!/usr/bin/env python3
"""End-to-end verification against a named test environment; --allow-write creates test users/messages.

No passwords or tokens are printed. Broker credentials are read from the supplied
private env file. This deliberately submits malformed events to all three DLQs.
"""
import argparse
import base64
import json
from pathlib import Path
import secrets
import time
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:18080")
    parser.add_argument("--broker", default="http://127.0.0.1:15672")
    parser.add_argument("--env-file", type=Path, default=Path(".env.platform-test"))
    parser.add_argument("--allow-write", action="store_true")
    args = parser.parse_args()

    def request(path, token=None, body=None, base=None, headers=None):
        values = dict(headers or {})
        if token: values["Authorization"] = "Bearer " + token
        if body is not None: values["Content-Type"] = "application/json"
        data = None if body is None else json.dumps(body).encode()
        with urlopen(Request((base or args.base) + path, data=data, headers=values), timeout=15) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    assert request("/api/public/health")["status"] == "UP"
    for token in [None, "invalid-token"]:
        try: request("/api/users/me", token)
        except HTTPError as error: assert error.code in [401, 403]
        else: raise AssertionError("Private endpoint accepted invalid credentials")
    if not args.allow_write:
        print(json.dumps({"health": "UP", "invalidTokensRejected": True, "writeTests": "not requested"})); return
    credentials = dict(line.split("=", 1) for line in args.env_file.read_text().splitlines() if "=" in line and not line.startswith("#"))
    basic = base64.b64encode((credentials.get("RABBITMQ_USER", "nexo") + ":" + credentials["RABBITMQ_PASSWORD"]).encode()).decode()
    auth = {"Authorization": "Basic " + basic}
    suffix = uuid.uuid4().hex[:10]
    sessions = [request("/api/auth/register", body={"email": f"review-{suffix}-{i}@example.test",
        "password": secrets.token_urlsafe(18), "displayName": f"Nexo verification {i}"}) for i in range(2)]
    tokens = [session["accessToken"] for session in sessions]
    channels = request("/api/workspace", tokens[0])["channels"]
    general = next(channel for channel in channels if channel["slug"] == "general")
    message = request(f"/api/conversations/{general['id']}/messages", tokens[0],
        {"clientId": str(uuid.uuid4()), "body": "Verificacion de avisos y actividad " + suffix})
    deadline = time.monotonic() + 30
    while True:
        workspace = request("/api/workspace", tokens[1])
        activity = request(f"/api/conversations/{general['id']}/activity", tokens[1])
        notification = any(item["messageId"] == message["id"] for item in workspace["notifications"])
        if notification and activity["messagesLastHour"] >= 1: break
        if time.monotonic() > deadline: raise AssertionError("Workers did not materialize notification/activity")
        time.sleep(1)
    queues = ["nexo.message.created", "nexo.message.audit", "nexo.conversation.activity"]

    def queue(name):
        return request("/api/queues/%2F/" + quote(name, safe=""), base=args.broker, headers=auth)

    before = {name: queue(name + ".failed")["messages"] for name in queues}
    routed = request("/api/exchanges/%2F/nexo.events.topic/publish", base=args.broker, headers=auth,
        body={"properties": {"content_type": "text/plain"}, "routing_key": "message.created",
              "payload": "invalid-verification-uuid", "payload_encoding": "string"})
    assert routed["routed"] is True
    deadline = time.monotonic() + 25
    while not all(queue(name + ".failed")["messages"] >= before[name] + 1 for name in queues):
        if time.monotonic() > deadline: raise AssertionError("A failed event did not reach its DLQ")
        time.sleep(1)
    result = {"health": "UP", "invalidTokensRejected": True, "notificationDelivered": notification,
              "activityProjected": activity["messagesLastHour"], "functionalQueues": len(queues), "dlqsVerified": len(queues),
              "messageId": message["id"], "testUsersCreated": 2}
    Path(".tmp").mkdir(exist_ok=True)
    Path(".tmp/platform-verification.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__": main()
