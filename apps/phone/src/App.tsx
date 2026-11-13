import { PhoneFrame } from "~/phone/PhoneFrame";
import { SlackScreen } from "~/slack/SlackScreen";

export function App({ slackUrl }: { slackUrl: string | null }) {
  return (
    <PhoneFrame>
      <SlackScreen slackUrl={slackUrl} />
    </PhoneFrame>
  );
}
