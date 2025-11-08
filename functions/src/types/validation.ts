import type { ACCESS_MODE } from "./documentSchemas.js";
import { GetMessagesRequest, NewChatRequest, NewMessageRequest, UpdateSettingsRequest } from "./apiTypes.js";
import { number, object, ObjectSchema, string, ValidateOptions } from "yup";


// This module provides functions responsible for validating all client input using the yup library


// yup options
const yupValOptions: ValidateOptions = {strict: true, abortEarly: true, stripUnknown: true, recursive: true};

// yup schemas
const updateUserSettingsSchema: ObjectSchema<UpdateSettingsRequest> = object({
  settings: object({
    username: string().required().trim().min(2).max(30)
  })
});
const newChatRequestSchema: ObjectSchema<NewChatRequest> = object({
  name: string().required().trim().min(3).max(50),
  access: string<ACCESS_MODE>().defined()
});
const newMessageRequestSchema: ObjectSchema<NewMessageRequest> = object({
  content: string().required().trim().min(1).max(1000)
});
const getMessagesRequestSchema: ObjectSchema<GetMessagesRequest> = object({
  message_count: number().required().integer().positive().max(50),
  prior_to: number().optional().integer().positive()
});


const CHAT_VISIBILITY: Record<string, ACCESS_MODE> = {'public': 'public', 'private': 'whitelist'};

export function validateNewChatForm(formData: object): NewChatRequest {
  if (typeof formData !== 'object') {
    throw new TypeError('new chat formData must be an object');
  }
  // TODO validate data using yup
  const data = formData as {'chat-name': string, 'chat-visibility': 'public' | 'private'};
  return {name: data['chat-name'], access: CHAT_VISIBILITY[data['chat-visibility']]};
}

export async function validateSettingsUpdateRequest(data: any): Promise<UpdateSettingsRequest> {
  return await updateUserSettingsSchema.validate(data, yupValOptions);
}

export async function validateNewChatRequest(data: any): Promise<NewChatRequest> {
  return await newChatRequestSchema.validate(data, yupValOptions);
}

export async function validateNewMessageRequest(data: any): Promise<NewMessageRequest> {
  return await newMessageRequestSchema.validate(data, yupValOptions);
}

export async function validateGetMessageRequest(data: any): Promise<GetMessagesRequest> {
  return await getMessagesRequestSchema.validate(data, yupValOptions);
}
