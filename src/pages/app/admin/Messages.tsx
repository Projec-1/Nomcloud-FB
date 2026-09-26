import { ChatText as MessageSquare } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import MessagesPanel from '@/components/dashboard/MessagesPanel'
import { useMessageThreads } from '@/hooks/useCommunications'

// Phase 8 batch 7. NEW SCREEN, and it exists for a structural reason.
//
// Only owner, director and administrator can open a conversation:
// message_threads INSERT and message_thread_participants INSERT are both keyed
// on has_school_admin_role. The prototype routed messaging to teachers and
// parents only, which are exactly the two roles that cannot start one. Without
// this page the feature has no entry point and every inbox stays permanently
// empty.
//
// Adding it is the inverse of the rule earlier batches applied when removing
// controls the database refuses. Here the database permits something the
// interface never offered.
//
// Participation still bounds what is visible. An administrator sees the threads
// they are in, not the school's mail.

export default function AdminMessages() {
  const { state, schoolId, userId, canStartThread, reload } = useMessageThreads()

  return (
    <div>
      <PageHeader title="Messages" description="Start and continue conversations with staff and parents." />
      <ResourceGate
        state={state}
        empty={{ icon: MessageSquare, title: 'No conversations yet' }}
        deniedHint="Messages are available to signed-in school members."
      >
        {(threads) => (
          <MessagesPanel
            threads={threads}
            schoolId={schoolId as string}
            currentUserId={userId as string}
            canStartThread={canStartThread}
            emptyDescription="Start a conversation with a teacher or a parent."
            onChanged={reload}
          />
        )}
      </ResourceGate>
    </div>
  )
}
