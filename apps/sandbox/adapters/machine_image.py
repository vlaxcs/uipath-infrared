from .aws_clients import AwsClients

IMAGE_NAME_PREFIX = "al2023-ami-"


def find_linux_image(clients: AwsClients) -> str:
    images = clients.ec2.describe_images(Owners=["amazon"])["Images"]
    matches = [image["ImageId"] for image in images if image.get("Name", "").startswith(IMAGE_NAME_PREFIX) and "arm64" not in image.get("Name", "")]
    if not matches:
        raise RuntimeError(f"no {IMAGE_NAME_PREFIX} x86_64 image registered in Floci")
    return matches[0]
