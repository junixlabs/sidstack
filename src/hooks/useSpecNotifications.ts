/**
 * Hook for spec approval notifications
 *
 * Sends notifications via group chat when specs are approved/rejected
 */

import { useCallback } from "react";

import { ipcRequest } from "@/lib/ipcClient";

interface NotifyOptions {
  specId: string;
  specTitle: string;
  action: "approved" | "rejected";
  reason?: string;
  approvedBy?: string;
}

// Use the shared ipcClient instead of creating new WebSocket per message
async function sendGroupChatMessage(
  fromRole: string,
  fromId: string,
  content: string
): Promise<void> {
  await ipcRequest("GroupChatSend", {
    from_role: fromRole,
    from_id: fromId,
    content,
  });
}

export function useSpecNotifications() {
  /**
   * Notify agents about spec approval/rejection via group chat
   */
  const notifySpecAction = useCallback(async (options: NotifyOptions) => {
    const { specId, specTitle, action, reason, approvedBy = "orchestrator" } = options;

    let message: string;
    if (action === "approved") {
      message = `@all Spec "${specTitle}" (${specId}) has been APPROVED by @${approvedBy}. Implementation can begin.`;
    } else {
      message = `@all Spec "${specTitle}" (${specId}) has been REJECTED by @${approvedBy}.${
        reason ? ` Reason: ${reason}` : ""
      } Please revise and resubmit.`;
    }

    try {
      await sendGroupChatMessage("orchestrator", "dashboard", message);
      console.log("[SpecNotifications] Sent group chat notification:", message);
    } catch (error) {
      console.error("[SpecNotifications] Failed to send notification:", error);
      // Don't throw - notification failure shouldn't block the approval
    }
  }, []);

  /**
   * Notify about new spec submitted for review
   */
  const notifyNewSpec = useCallback(async (specId: string, specTitle: string, submittedBy: string) => {
    const message = `@orchestrator New spec "${specTitle}" (${specId}) submitted for review by @${submittedBy}. Please review and approve/reject.`;

    try {
      await sendGroupChatMessage(submittedBy, "dashboard", message);
      console.log("[SpecNotifications] Sent new spec notification:", message);
    } catch (error) {
      console.error("[SpecNotifications] Failed to send notification:", error);
    }
  }, []);

  return {
    notifySpecAction,
    notifyNewSpec,
  };
}

export default useSpecNotifications;
