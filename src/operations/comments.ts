/**
 * Comment operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import { Comment } from "../schemas/entities.js";
import {
  CreateCommentSchema,
  UpdateCommentSchema,
  CreateCommentInput,
  UpdateCommentInput,
} from "../schemas/requests.js";
import { CommentResponse, CommentsResponse } from "../schemas/responses.js";
import { PlankaError } from "../errors.js";

/**
 * Add a comment to a card.
 */
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const validated = CreateCommentSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/cards/${validated.cardId}/comments`,
    {
      text: validated.text,
    }
  );

  const parsed = CommentResponse.parse(response);
  return parsed.item;
}

/**
 * Update a comment's text.
 */
export async function updateComment(
  commentId: string,
  input: UpdateCommentInput
): Promise<Comment> {
  const validated = UpdateCommentSchema.parse(input);

  const response = await plankaClient.patch<unknown>(
    `/api/comments/${commentId}`,
    validated
  );

  const parsed = CommentResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a comment.
 */
export async function deleteComment(commentId: string): Promise<void> {
  await plankaClient.delete(`/api/comments/${commentId}`);
}

/**
 * Get all comments for a card, newest first.
 *
 * PLANKA 2.0 does not include comments in GET /cards/:id; they come from
 * GET /cards/:cardId/comments, one page at a time. Each page is newest first,
 * and the next page is requested with ?beforeId=<oldest id so far> until a page is empty.
 */
export async function getCommentsForCard(cardId: string): Promise<Comment[]> {
  const comments: Comment[] = [];
  let beforeId: string | undefined;

  for (;;) {
    const query = beforeId === undefined ? "" : `?beforeId=${encodeURIComponent(beforeId)}`;
    const response = await plankaClient.get<unknown>(`/api/cards/${cardId}/comments${query}`);
    const page = CommentsResponse.parse(response).items;
    if (page.length === 0) return comments;

    const oldestId = page[page.length - 1].id;
    if (oldestId === beforeId) {
      // A server that ignores beforeId would otherwise make this loop forever.
      throw new PlankaError(
        `Comment pagination for card ${cardId} did not advance past comment ${oldestId}`,
        "PAGINATION_ERROR",
        502
      );
    }
    comments.push(...page);
    beforeId = oldestId;
  }
}
