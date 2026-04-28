import { seedDatabase, setupDatabase } from "../src/lib/db/setup.js";

await setupDatabase();
await seedDatabase();

console.log("Database schema is ready and seed data has been applied.");
