// Clerk session JWT custom claim — populated by the Clerk dashboard template:
//   { "role": "{{user.public_metadata.role}}" }
// See .planning/phases/03-classroom-features/03-CLERK-SETUP.md

declare global {
  interface CustomJwtSessionClaims {
    role?: 'instructor' | 'student';
  }
}

export {};
