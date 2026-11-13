import re

SECRET_NAME = re.compile(r"(pass(word)?|secret|token|api[_-]?key|private[_-]?key|stripe)", re.I)


def plaintext_secrets_suspected(environment):
    return any(SECRET_NAME.search(name) and value for name, value in environment.items())
