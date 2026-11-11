import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, Globe2, Languages, Mail, Monitor, Smartphone, Users, UsersRound } from "lucide-react";

import { audienceQuery, engagementQuery, retryUnlessForbidden } from "../../api/admin.js";
import { number } from "./adminFormat.js";
import { BarList, Delta, ErrorCard, Panel, RangePicker, Tile } from "./adminParts.jsx";

const percent = (value) => (value == null ? "—" : `${value}%`);

// Who the audience is (devices, browsers, languages, currencies) and how notifications
// and push are doing. Figures are people, counted once, from sign-ins in the picked range.
export default function AudienceReport() {
  const [days, setDays] = useState(30);
  const audience = useQuery({ ...audienceQuery(days), retry: retryUnlessForbidden });
  const engagement = useQuery({ ...engagementQuery(days), retry: retryUnlessForbidden });
  const a = audience.data;
  const e = engagement.data;
  const error = (audience.error && !a && audience.error) || (engagement.error && !e && engagement.error);

  return (
    <section className="admin-section" aria-labelledby="admin-audience-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-audience-title">
            <UsersRound size={18} /> Audience
          </h2>
          <p>Who signs in, and how alerts reach them</p>
        </div>
        <RangePicker days={days} onChange={setDays} />
      </div>

      {error ? (
        <ErrorCard error={error} />
      ) : (
        <>
          <div className="admin-stats">
            <Tile label="People who signed in" icon={Users} tone="blue" value={number(a?.activeUsers)} loading={!a} />
            <Tile label="Push on" icon={BellRing} tone="teal" value={number(e?.push.users)} hint={e && `${number(e.push.devices)} devices`} loading={!e} />
            <Tile label="Email alerts on" icon={Mail} tone="purple" value={percent(e?.preferences.emailRate)} hint="of users with settings" loading={!e} />
            <Tile label="Notifications read" icon={Bell} tone="orange" value={percent(e?.notifications.readRate)} hint={e && `${number(e.notifications.read)} of ${number(e.notifications.sent)}`} loading={!e} />
          </div>

          <div className="admin-ins-grid">
            <Panel title="Devices" icon={Smartphone} hint="People by device type">
              <BarList items={a?.devices} />
            </Panel>
            <Panel title="Browsers" icon={Globe2} hint="People by browser">
              <BarList items={a?.browsers} />
            </Panel>
            <Panel title="Operating systems" icon={Monitor} hint="People by system">
              <BarList items={a?.systems} />
            </Panel>
            <Panel title="Languages" icon={Languages} hint="Chosen in settings">
              <BarList items={a?.languages} empty="Nobody has saved a language yet." />
            </Panel>
            <Panel title="Currencies" icon={Languages} hint="Chosen in settings">
              <BarList items={a?.currencies} empty="Nobody has saved a currency yet." />
            </Panel>
            <Panel
              title="Notifications sent"
              icon={Bell}
              hint="By type, in this period"
              actions={e && <Delta value={e.notifications.sent} previous={e.notifications.previous} />}
            >
              <BarList items={e?.notifications.byType} empty="No notifications were sent in this period." />
              {e && (
                <p className="admin-ins-foot">
                  {e.push.failingDevices > 0
                    ? `${number(e.push.failingDevices)} of ${number(e.push.devices)} push devices have recent delivery failures; they are dropped after 5 in a row.`
                    : "No push devices have delivery failures."}
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}
