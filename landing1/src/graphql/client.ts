import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client';

// Apollo Client instance
export const client = new ApolloClient({
  link: new HttpLink({
    uri: 'http://localhost:4000/graphql',
  }),
  cache: new InMemoryCache()
});

// GraphQL Queries
export const GET_DASHBOARD = gql`
  query GetDashboard {
    dashboard {
      timeSaved {
        hours
        period
      }
      stats {
        queries
        documents
        accuracy
      }
      calendarEvents {
        id
        date
        event
        caseId
        upcoming
      }
      ongoingCases {
        id
        parties
        progress
        stage
      }
      completedCases {
        id
        parties
        verdict
        details
        date
      }
      documentLibrary {
        id
        name
        date
      }
    }
  }
`;

// GraphQL Mutations
export const UPDATE_TIME_SAVED = gql`
  mutation UpdateTimeSaved($input: TimeSavedInput!) {
    updateTimeSaved(input: $input) {
      hours
      period
    }
  }
`;

export const UPDATE_STATS = gql`
  mutation UpdateStats($input: StatsInput!) {
    updateStats(input: $input) {
      queries
      documents
      accuracy
    }
  }
`;

export const ADD_ONGOING_CASE = gql`
  mutation AddOngoingCase($input: OngoingCaseInput!) {
    addOngoingCase(input: $input) {
      id
      parties
      progress
      stage
    }
  }
`;

export const UPDATE_ONGOING_CASE = gql`
  mutation UpdateOngoingCase($id: ID!, $input: OngoingCaseInput!) {
    updateOngoingCase(id: $id, input: $input) {
      id
      parties
      progress
      stage
    }
  }
`;

export const DELETE_ONGOING_CASE = gql`
  mutation DeleteOngoingCase($id: ID!) {
    deleteOngoingCase(id: $id)
  }
`;

export const ADD_COMPLETED_CASE = gql`
  mutation AddCompletedCase($input: CompletedCaseInput!) {
    addCompletedCase(input: $input) {
      id
      parties
      verdict
      details
      date
    }
  }
`;

export const ADD_DOCUMENT = gql`
  mutation AddDocument($input: DocumentInput!) {
    addDocument(input: $input) {
      id
      name
      date
    }
  }
`;

export const ADD_CALENDAR_EVENT = gql`
  mutation AddCalendarEvent($input: CalendarEventInput!) {
    addCalendarEvent(input: $input) {
      id
      date
      event
      caseId
      upcoming
    }
  }
`;
