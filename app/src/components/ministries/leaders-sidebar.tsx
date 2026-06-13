// app/src/components/ministries/leaders-sidebar.tsx
import { NetworkLeadersData } from "@/actions/ministry-leaders";
import { LeaderSlot } from "./leader-slot";

export function LeadersSidebar({ data }: { data: NetworkLeadersData[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        No networks found.
      </div>
    );
  }

  const openNetworkHeads = data.filter((network) => !network.networkHead).length;
  const openMinistryHeads = data.reduce(
    (count, network) =>
      count + network.chapters.filter((chapter) => !chapter.head).length,
    0
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
          Leadership
        </p>
        <h2 className="mt-1 text-lg font-bold text-gray-950">
          Appointments
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-500">Network gaps</p>
            <p className="mt-1 text-base font-bold text-gray-950">
              {openNetworkHeads}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-500">Ministry gaps</p>
            <p className="mt-1 text-base font-bold text-gray-950">
              {openMinistryHeads}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
      {data.map((net) => (
        <section key={net.networkId} className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-950">
                {net.networkName}
              </h3>
              <p className="text-xs text-gray-500">
                {net.chapters.length} active chapters
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Network Head
            </p>
            <LeaderSlot
              type="NETWORK_HEAD"
              networkId={net.networkId}
              head={net.networkHead}
            />
          </div>

          <div className="mt-3 space-y-3">
            {net.chapters.map((ch) => (
              <div
                key={ch.chapterId}
                className="rounded-md border border-gray-200 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {ch.ministryName}
                    </p>
                    {net.chapters.filter((c) => c.ministryId === ch.ministryId)
                      .length > 1 && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {ch.branchName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Ministry Head
                    </p>
                    <LeaderSlot
                      type="MINISTRY_HEAD"
                      chapterId={ch.chapterId}
                      membershipId={ch.head?.membershipId}
                      head={
                        ch.head
                          ? {
                              leaderId: ch.head.membershipId,
                              memberId: ch.head.memberId,
                              firstName: ch.head.firstName,
                              lastName: ch.head.lastName,
                              memberCode: ch.head.memberCode,
                            }
                          : null
                      }
                    />
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Inner Core ({ch.innerCore.length})
                    </p>
                    <div className="mt-1 space-y-1">
                      {ch.innerCore.map((ic) => (
                        <LeaderSlot
                          key={ic.membershipId}
                          type="INNER_CORE"
                          chapterId={ch.chapterId}
                          membershipId={ic.membershipId}
                          head={{
                            leaderId: ic.membershipId,
                            memberId: ic.memberId,
                            firstName: ic.firstName,
                            lastName: ic.lastName,
                            memberCode: ic.memberCode,
                          }}
                        />
                      ))}
                      <LeaderSlot
                        type="INNER_CORE"
                        chapterId={ch.chapterId}
                        head={null}
                        alwaysShowAppoint
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
