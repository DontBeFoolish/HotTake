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
    controversyScore: Float
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

  type PostConnection {
    posts: [Post!]!
    nextCursor: ID
  }

  type Query {
    allPosts(content: String, after: ID, limit: Int): PostConnection!
    userPosts(ownerId: ID!, after: ID, limit: Int): PostConnection!
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

  type Subscription {
    postAdded: Post
  }
`;

module.exports = typeDefs;
