# Locket Monorepo

## Build & test conventions

- Tests: `npm run test` at the root (Turborepo). Targeted: `cd apps/mobile && npx vitest run`.
  Full matrix and per-phase commands live in `TESTING.md`.
- **apps/mobile needs a native rebuild after any `app.json` change.** `app.json` registers
  native config plugins (currently `expo-secure-store`, `expo-sqlite`, and
  `@kingstinct/react-native-healthkit` for read-only Apple Health access). Metro reload does
  not apply entitlement or Info.plist changes — run `npx expo prebuild`, then
  `(cd ios && pod install)`, then `npx expo run:ios`.
- HealthKit cannot be verified in the iOS Simulator; cycle-tracking reads need a physical
  device. Its unit tests mock the native module and run anywhere.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
