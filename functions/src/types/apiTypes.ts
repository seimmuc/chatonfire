import { ACCESS_MODE, Message } from "./documentSchemas.js";

interface ApiResponse {
  /** HTTP status code */
  status: number;
};
interface ErrorResponse extends ApiResponse {
  /** Error type */
  error: string;
  /** Human-readable error description */
  error_message: string;
}

// New chat request
export interface NewChatRequest {
  /** Chat's name */
  name: string;
  /** Chat's access level: "public" or "whitelist" */
  access: ACCESS_MODE;
}
export interface NewChatResponse extends ApiResponse {
  /** New chat's identifier */
  chat_id: string;
  /** Url to the new chat's web page */
  chat_url_path: string;
}
export interface NewChatError extends ErrorResponse {}

// New message request
export interface NewMessageRequest {
  /** Content of the message */
  content: string;
}
export interface NewMessageResponse extends ApiResponse {}
export interface NewMessageError extends ErrorResponse {}

// Get message request
export interface GetMessagesRequest {
  /** Max number of messages to fetch, hard limited to 50 */
  message_count: number;
  /** If present, all fetched messages will be older than this timestamp. This should be the timestamp of the earliest message that the client already has */
  prior_to?: number;
}
export interface GetMessagesResponse extends ApiResponse {
  /** an array of messages that matched the request */
  messages: Message[];
}
export interface GetMessagesError extends ErrorResponse {}
