// src/services/dynamo.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "dotenv";
config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || "Calendar";

export interface JournalSummary {
  userId: string;
  date: string;
  polishedEntry: string;
  keyPoints: string;
  originalEntries: string[];
}

export async function storeSummary(summary: JournalSummary) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...summary,
      timestamp: Date.now(),
    },
  });

  try {
    await docClient.send(command);
  } catch (error) {
    console.error("Error storing summary:", error);
    throw error;
  }
}

export async function getSummariesByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression:
      "userId = :userId AND #date BETWEEN :startDate AND :endDate",
    ExpressionAttributeNames: {
      "#date": "date",
    },
    ExpressionAttributeValues: {
      ":userId": userId,
      ":startDate": startDate,
      ":endDate": endDate,
    },
  });

  try {
    const response = await docClient.send(command);
    return response.Items as JournalSummary[];
  } catch (error) {
    console.error("Error fetching summaries:", error);
    throw error;
  }
}

export async function getSummaryDates(
  userId: string,
  startDate: string,
  endDate: string,
) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression:
      "userId = :userId AND #date BETWEEN :startDate AND :endDate",
    ExpressionAttributeNames: {
      "#date": "date",
    },
    ExpressionAttributeValues: {
      ":userId": userId,
      ":startDate": startDate,
      ":endDate": endDate,
    },
    ProjectionExpression: "#date", // Only retrieve the date field
  });

  try {
    const response = await docClient.send(command);
    return response.Items?.map((item) => item.date) || [];
  } catch (error) {
    console.error("Error fetching summary dates:", error);
    throw error;
  }
}
