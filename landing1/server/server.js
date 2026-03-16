import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';

// In-memory data store (can be replaced with database)
let dashboardData = {
    timeSaved: {
        hours: 127,
        period: "this month"
    },
    stats: {
        queries: 342,
        documents: 89,
        accuracy: 94.2
    },
    calendarEvents: [
        { id: "1", date: "Dec 26", event: "Hearing", caseId: "#42", upcoming: true },
        { id: "2", date: "Dec 28", event: "Filing", caseId: "#38", upcoming: false },
        { id: "3", date: "Jan 02", event: "Hearing", caseId: "#45", upcoming: false },
        { id: "4", date: "Jan 05", event: "Review", caseId: "#42", upcoming: false }
    ],
    ongoingCases: [
        { id: "2024-0042", parties: "Kumar vs State", progress: 80, stage: "Appeal" },
        { id: "2024-0038", parties: "Singh vs Corp", progress: 50, stage: "Trial" },
        { id: "2024-0045", parties: "Sharma vs Bank", progress: 30, stage: "Filing" }
    ],
    completedCases: [
        { id: "2024-0035", parties: "Patel vs State", verdict: "WON", details: "Acquitted", date: "Dec 20" },
        { id: "2024-0031", parties: "Verma vs Corp", verdict: "SETTLED", details: "₹5L", date: "Dec 18" },
        { id: "2024-0028", parties: "Gupta vs Union", verdict: "LOST", details: "Dismissed", date: "Dec 15" },
        { id: "2024-0025", parties: "Reddy vs Bank", verdict: "WON", details: "Damages Awarded", date: "Dec 10" },
        { id: "2024-0021", parties: "Khan vs State", verdict: "WON", details: "Released", date: "Dec 05" }
    ],
    documentLibrary: [
        { id: "1", name: "Kumar vs State", date: "Dec 24, 2024" },
        { id: "2", name: "Singh vs Corp", date: "Dec 20, 2024" },
        { id: "3", name: "Sharma vs Bank", date: "Dec 18, 2024" },
        { id: "4", name: "Patel vs State", date: "Dec 15, 2024" },
        { id: "5", name: "Verma vs Corp", date: "Dec 12, 2024" },
        { id: "6", name: "Gupta vs Union", date: "Dec 10, 2024" }
    ]
};

// GraphQL Schema
const typeDefs = `#graphql
  type TimeSaved {
    hours: Int!
    period: String!
  }

  type Stats {
    queries: Int!
    documents: Int!
    accuracy: Float!
  }

  type CalendarEvent {
    id: ID!
    date: String!
    event: String!
    caseId: String!
    upcoming: Boolean!
  }

  type OngoingCase {
    id: ID!
    parties: String!
    progress: Int!
    stage: String!
  }

  type CompletedCase {
    id: ID!
    parties: String!
    verdict: String!
    details: String!
    date: String!
  }

  type Document {
    id: ID!
    name: String!
    date: String!
  }

  type DashboardData {
    timeSaved: TimeSaved!
    stats: Stats!
    calendarEvents: [CalendarEvent!]!
    ongoingCases: [OngoingCase!]!
    completedCases: [CompletedCase!]!
    documentLibrary: [Document!]!
  }

  input TimeSavedInput {
    hours: Int!
    period: String!
  }

  input StatsInput {
    queries: Int!
    documents: Int!
    accuracy: Float!
  }

  input CalendarEventInput {
    id: ID
    date: String!
    event: String!
    caseId: String!
    upcoming: Boolean!
  }

  input OngoingCaseInput {
    id: ID!
    parties: String!
    progress: Int!
    stage: String!
  }

  input CompletedCaseInput {
    id: ID!
    parties: String!
    verdict: String!
    details: String!
    date: String!
  }

  input DocumentInput {
    id: ID
    name: String!
    date: String!
  }

  type Query {
    dashboard: DashboardData!
    timeSaved: TimeSaved!
    stats: Stats!
    calendarEvents: [CalendarEvent!]!
    ongoingCases: [OngoingCase!]!
    completedCases: [CompletedCase!]!
    documentLibrary: [Document!]!
  }

  type Mutation {
    updateTimeSaved(input: TimeSavedInput!): TimeSaved!
    updateStats(input: StatsInput!): Stats!
    addCalendarEvent(input: CalendarEventInput!): CalendarEvent!
    updateCalendarEvent(id: ID!, input: CalendarEventInput!): CalendarEvent!
    deleteCalendarEvent(id: ID!): Boolean!
    addOngoingCase(input: OngoingCaseInput!): OngoingCase!
    updateOngoingCase(id: ID!, input: OngoingCaseInput!): OngoingCase!
    deleteOngoingCase(id: ID!): Boolean!
    addCompletedCase(input: CompletedCaseInput!): CompletedCase!
    updateCompletedCase(id: ID!, input: CompletedCaseInput!): CompletedCase!
    deleteCompletedCase(id: ID!): Boolean!
    addDocument(input: DocumentInput!): Document!
    updateDocument(id: ID!, input: DocumentInput!): Document!
    deleteDocument(id: ID!): Boolean!
  }
`;

// Resolvers
const resolvers = {
    Query: {
        dashboard: () => dashboardData,
        timeSaved: () => dashboardData.timeSaved,
        stats: () => dashboardData.stats,
        calendarEvents: () => dashboardData.calendarEvents,
        ongoingCases: () => dashboardData.ongoingCases,
        completedCases: () => dashboardData.completedCases,
        documentLibrary: () => dashboardData.documentLibrary
    },
    Mutation: {
        updateTimeSaved: (_, { input }) => {
            dashboardData.timeSaved = input;
            return dashboardData.timeSaved;
        },
        updateStats: (_, { input }) => {
            dashboardData.stats = input;
            return dashboardData.stats;
        },
        addCalendarEvent: (_, { input }) => {
            const newEvent = { ...input, id: input.id || String(Date.now()) };
            dashboardData.calendarEvents.push(newEvent);
            return newEvent;
        },
        updateCalendarEvent: (_, { id, input }) => {
            const idx = dashboardData.calendarEvents.findIndex(e => e.id === id);
            if (idx !== -1) {
                dashboardData.calendarEvents[idx] = { ...input, id };
                return dashboardData.calendarEvents[idx];
            }
            throw new Error('Event not found');
        },
        deleteCalendarEvent: (_, { id }) => {
            const idx = dashboardData.calendarEvents.findIndex(e => e.id === id);
            if (idx !== -1) {
                dashboardData.calendarEvents.splice(idx, 1);
                return true;
            }
            return false;
        },
        addOngoingCase: (_, { input }) => {
            dashboardData.ongoingCases.push(input);
            return input;
        },
        updateOngoingCase: (_, { id, input }) => {
            const idx = dashboardData.ongoingCases.findIndex(c => c.id === id);
            if (idx !== -1) {
                dashboardData.ongoingCases[idx] = input;
                return input;
            }
            throw new Error('Case not found');
        },
        deleteOngoingCase: (_, { id }) => {
            const idx = dashboardData.ongoingCases.findIndex(c => c.id === id);
            if (idx !== -1) {
                dashboardData.ongoingCases.splice(idx, 1);
                return true;
            }
            return false;
        },
        addCompletedCase: (_, { input }) => {
            dashboardData.completedCases.unshift(input);
            if (dashboardData.completedCases.length > 5) {
                dashboardData.completedCases.pop();
            }
            return input;
        },
        updateCompletedCase: (_, { id, input }) => {
            const idx = dashboardData.completedCases.findIndex(c => c.id === id);
            if (idx !== -1) {
                dashboardData.completedCases[idx] = input;
                return input;
            }
            throw new Error('Case not found');
        },
        deleteCompletedCase: (_, { id }) => {
            const idx = dashboardData.completedCases.findIndex(c => c.id === id);
            if (idx !== -1) {
                dashboardData.completedCases.splice(idx, 1);
                return true;
            }
            return false;
        },
        addDocument: (_, { input }) => {
            const newDoc = { ...input, id: input.id || String(Date.now()) };
            dashboardData.documentLibrary.unshift(newDoc);
            return newDoc;
        },
        updateDocument: (_, { id, input }) => {
            const idx = dashboardData.documentLibrary.findIndex(d => d.id === id);
            if (idx !== -1) {
                dashboardData.documentLibrary[idx] = { ...input, id };
                return dashboardData.documentLibrary[idx];
            }
            throw new Error('Document not found');
        },
        deleteDocument: (_, { id }) => {
            const idx = dashboardData.documentLibrary.findIndex(d => d.id === id);
            if (idx !== -1) {
                dashboardData.documentLibrary.splice(idx, 1);
                return true;
            }
            return false;
        }
    }
};

// Create Apollo Server
const server = new ApolloServer({
    typeDefs,
    resolvers
});

// Start server
const app = express();

await server.start();

app.use(
    '/graphql',
    cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }),
    express.json(),
    expressMiddleware(server)
);

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🚀 GraphQL Server ready at http://localhost:${PORT}/graphql`);
});
