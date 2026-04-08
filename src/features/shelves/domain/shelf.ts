// src/features/shelves/domain/shelf.ts
// Domain types for the Curated Shelves feature.
// Shelf is the first relational model in the app — many-to-many with readables.

export interface Shelf {
  id: string;
  name: string;
  sortOrder: number;
  dateCreated: string;
  dateUpdated: string;
}

export interface ShelfReadable {
  shelfId: string;
  readableId: string;
  position: number;
  dateAdded: string;
}
