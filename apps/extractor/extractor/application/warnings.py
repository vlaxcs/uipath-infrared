MESSAGE_LIMIT = 140


class Warnings:
    def __init__(self):
        self.messages = []

    def note(self, message):
        self.messages.append(message)

    def failure(self, label, error):
        self.note(f"{label}: {str(error)[:MESSAGE_LIMIT]}")

    def guard(self, label, call, default=None):
        try:
            return call()
        except Exception as error:
            self.failure(label, error)
            return default


def attempt(call):
    try:
        return call()
    except Exception:
        return None
