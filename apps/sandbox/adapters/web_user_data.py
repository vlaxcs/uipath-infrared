from .network_builder import APP_PORT


def web_server_script() -> str:
    return "\n".join(
        [
            "#!/bin/bash",
            "mkdir -p /srv/www",
            "echo \"ok $AWS_EC2_INSTANCE_ID\" > /srv/www/index.html",
            "cd /srv/www",
            f"setsid -f python3 -m http.server {APP_PORT} </dev/null >/var/log/sandbox-web.log 2>&1",
            "",
        ]
    )
