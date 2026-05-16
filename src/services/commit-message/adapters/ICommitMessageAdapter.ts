import { CommitMessageRequest, CommitMessageResult } from "../types/core"

export interface ICommitMessageAdapter {
	generateCommitMessage(request: CommitMessageRequest): Promise<CommitMessageResult>
}
