const typeDefs = /* GraphQL */ `
  enum UserRole {
    USER
    MODERATOR
    ADMIN
  }

  enum AuthRole {
    MODERATOR
    ADMIN
  }

  enum VoteValue {
    AGREE
    DISAGREE
  }

  type User {
    username: String!
    role: UserRole!
    createdAt: String!
    deleted: Boolean!
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
    deleted: Boolean!
    id: ID!
  }

  type Vote {
    user: User!
    post: Post!
    value: VoteValue!
    createdAt: String!
    id: ID!
  }

  type PostConnection {
    posts: [Post!]!
    nextCursor: ID
  }

  type ModMessage {
    content: String!
    user: User!
    role: AuthRole!
    createdAt: String!
    deleted: Boolean!
    id: ID!
  }

  type Query {
    allPosts(after: ID): PostConnection!
    userPosts(ownerId: ID!, after: ID): PostConnection!
    findPost(postId: ID!): Post
    allUsers: [User!]!
    findUser(username: String!): User
    me: User
  }

  type Mutation {
    addUser(username: String!, password: String!): User
    setUserRole(userId: ID!, role: UserRole!): User
    login(username: String!, password: String!): Token
    addPost(content: String!): Post
    removePost(postId: ID!): Post
    addVote(postId: ID!, value: VoteValue!): Post
    addModMessage(content: String!): ModMessage
    removeModMessage(messsageId: ID!): ModMessage
    clearDb: Boolean
  }

  type Subscription {
    postAdded: Post
    modMessageAdded: ModMessage
  }
`;

module.exports = typeDefs;
