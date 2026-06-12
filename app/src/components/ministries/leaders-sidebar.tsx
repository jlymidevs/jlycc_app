// app/src/components/ministries/leaders-sidebar.tsx
import { NetworkLeadersData } from "@/actions/ministry-leaders";
import { LeaderSlot } from "./leader-slot";

export function LeadersSidebar({ data }: { data: NetworkLeadersData[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic">No networks found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Leaders
      </h2>
      {data.map((net) => (
        <div key={net.networkId} className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-1">
            {net.networkName}
          </h3>

          {/* Network Head */}
          <div className="pl-2 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Network Head
            </p>
            <LeaderSlot
              type="NETWORK_HEAD"
              networkId={net.networkId}
              head={net.networkHead}
            />
          </div>

          {/* Chapters */}
          {net.chapters.map((ch) => (
            <div key={ch.chapterId} className="pl-2 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                {ch.ministryName}
                {net.chapters.filter((c) => c.ministryId === ch.ministryId)
                  .length > 1 && (
                  <span className="ml-1 text-gray-400">· {ch.branchName}</span>
                )}
              </p>

              {/* Ministry Head */}
              <div className="pl-3 space-y-1">
                <p className="text-xs text-gray-400">Ministry Head</p>
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

              {/* Inner Core */}
              <div className="pl-3 space-y-1">
                <p className="text-xs text-gray-400">
                  Inner Core ({ch.innerCore.length})
                </p>
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
                {/* Always show + Appoint for Inner Core */}
                <LeaderSlot
                  type="INNER_CORE"
                  chapterId={ch.chapterId}
                  head={null}
                  alwaysShowAppoint
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
