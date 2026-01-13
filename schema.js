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
    title: String!
    body: String!
    votes: VoteCount!
    owner: User!
    createdAt: String!
    id: ID!
  }

  enum Value {
    AGREE
    DISAGREE
  }

  type Vote {
    user: User!
    post: Post!
    value: Value!
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
    addPost(title: String!, body: String!): Post
  }
`;

module.exports = typeDefs;
