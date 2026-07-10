export type PostCategory = "all" | "party" | "question" | "review" | "tip";

export type WritablePostCategory = Exclude<PostCategory, "all">;

export interface PartyMember {
  id: string;
  name: string;
  avatar: string;
  joinedAtIso: string;
  isHost?: boolean;
}

export interface PartyInfo {
  startDate: string;
  endDate: string;
  needed: number;
  current: number;
  budgetPerPerson?: string;
  members: PartyMember[];
}

export interface PostComment {
  id: string;
  authorId: string;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
  createdAtIso: string;
}

export interface CommunityPost {
  id: string;
  category: WritablePostCategory;
  authorId: string;
  author: string;
  avatar: string;
  destination: string;
  title: string;
  preview: string;
  images?: string[];
  likes: number;
  comments: number;
  likedBy: string[];
  commentList: PostComment[];
  createdAt: string;
  createdAtIso: string;
  party?: PartyInfo;
}

export type CreatePostInput = {
  category: WritablePostCategory;
  title: string;
  destination: string;
  body: string;
  imageUrls?: string[];
  party?: PartyInfo;
};

export type UpdatePostInput = CreatePostInput;
