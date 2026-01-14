const typeDefs = /* GraphQL */ `
  type User {
    username: String!
    passwordHash: String!
    createdAt: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type VoteCount {
    agree: Int!
    disagree: Int!
  }

  type Post {
    content: String!
    votes: VoteCount!
    owner: User!
    controversyScore: Float!
    userVote: VoteValue
    createdAt: String!
    id: ID!
  }

  enum VoteValue {
    AGREE
    DISAGREE
  }

  type Vote {
    user: User!
    post: Post!
    value: VoteValue!
    createdAt: String!
  }

  type Query {
    allPosts: [Post!]!
    findPost(postId: ID!): Post
    allUsers: [User!]!
    findUser(username: String!): User
    me: User
  }

  type Mutation {
    addUser(username: String!, password: String!): User
    login(username: String!, password: String!): Token
    addPost(content: String!): Post
    removePost(postId: ID!): Boolean
    addVote(postId: ID!, value: VoteValue!): Post
    clearDb: Boolean
  }
`;

module.exports = typeDefs;
