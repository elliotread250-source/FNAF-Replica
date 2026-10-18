// The Day Manager's phone calls for the free-roam nights (Part 7). Placeholders are filled through the
// roster so original mode never shows a tribute name. Lines in [brackets] are sound cues, not speech.

export const FR_CALLS: Record<number, string[]> = {
  1: [
    "Hey! Hello, hi. Okay, is this thing recording? Yeah. Okay. Welcome to the night shift at {venue}, Location Seven! I'm the day manager, and I've been asked to leave you all a few orientation notes.",
    "There's four of you this year, which is new. Corporate's never hired a whole team for nights before. Don't read into that.",
    "So. First thing. The power. The building's on its last legs, electrically speaking. When you clock in, the main breaker's off to save money overnight.",
    "You'll need to head down to the basement, find the breaker room, and get the power back on. There's a panel with a big needle. Get the needle in the green, pull the big lever. If it bangs and sparks, you overdid it. Wait for it to cool and try again. Easy.",
    "Then go round and turn the lights on, zone by zone. Some of the fuses are shot. There's spares in the supply closet off the east hall. Try not to leave every light on all night, though. The power doesn't last forever, and trust me, you don't want to be in here when it runs out.",
    "Second thing. The music box. Prize Corner, back of the dining hall. There's a crank. Give it a good wind every now and then. It's been here longer than me. Just keep it playing, okay? Keep it playing.",
    "Third thing. The cupcakes. Tonight was supposed to be a birthday party, and the kitchen made cupcakes, and corporate wants them out on the birthday tables for the morning. Five cupcakes, five tables with the little star cards. Don't eat them.",
    "And, uh. The characters. {leader}, {rabbit}, {bird}, and our pirate pal {fox} back in the cove. They're on a free-roam mode at night. Something about the servos locking up if they stand still too long. They'll wander.",
    "If they see you, they might not, um, recognise you as a person. They might think you're a bare endoskeleton without a costume on, and that's against the rules here, so they'll try to help you into one. Which, the costumes are full of crossbeams and wiring. So. You'd rather not.",
    "If one of them spots you, get out of sight. There's lockers, cupboards, tables, whatever. Hide, stay quiet, let them lose interest. If one of your team gets grabbed, they'll be shaken up but they'll live, probably, if you get to them fast and help them up. So stick close-ish.",
    "Okay. That's it. Clipboard's by the time clock. Good luck, you four. I'll check in tomorrow.",
  ],
  2: [
    "Hey, hello! You all made it to night two! Great. I mean that. Last year's guy didn't, uh. Never mind.",
    "So, things get a little busier from here. {rabbit} and {bird} get more curious. {rabbit} especially likes to pop up where you just looked, so keep checking behind you.",
    "{bird} lives in the kitchen if you let her. She can smell those cupcakes. Seriously. If you're carrying a whole armful past the kitchen, you're basically a walking dinner bell. Maybe split them up between you.",
    "And {fox}. The pirate. He's back online tonight. He doesn't like being watched, but he hates being ignored. Somebody needs to check the cove every so often. In person, or on the cameras.",
    "If the curtain's open and he's gone, he's running. Down the west hall, usually. Fast. Get out of the hallway, get behind a door, or get hidden. You'll hear him coming.",
    "Somebody can sit in the security office and keep an eye on everyone through the cameras, if you want. There's a tablet on the desk too. You can play the showtime jingle from the stage booth to draw the characters away from your friends. Think of it as teamwork.",
    'Okay! Talk soon!',
  ],
  3: [
    "Hello, hey, night three, look at you four! You're practically veterans. I've got a feeling you're the team that makes it.",
    "The music box. Tonight it matters. I can't really explain the, uh, the thing in the box. Just, if the music stops, it comes out. And it doesn't stop coming until the music starts again.",
    "Doors don't help. Hiding doesn't help. Only the music. So whoever's closest, wind it. You can wind it from the cameras too, slower. Keep it above half if things get hairy.",
    "And {leader}. He's going to start moving now. Here's the strange part: he doesn't move while you're looking at him. At all. So look at him.",
    "And if you need to turn your back, make sure somebody else has eyes on him. Cameras count. If he's out of sight, he's closer. He likes the dark, so lit rooms help.",
    "And if anybody sees a gold bear somewhere he shouldn't be, just, look away. Don't ask why. I don't know why. Okay, bye!",
  ],
  4: [
    "Uh, hello? Hey. Hi. Listen, if you're hearing this and you're all still together, great, I had a feeling you'd make it.",
    "I'm, uh, I might not be around to record these much longer. It's been a rough few nights.",
    "There's a backup generator in the boiler room. You'll want it running tonight. The battery's on a cart at the loading dock. It's heavy.",
    "I'm going to sit tight in the office here and hope the banging stops on its own.",
    '[a long pause, then distant banging]',
    'Oh, no...',
    '[music box]',
    '[a groan, then a screech, then static]',
  ],
  5: [
    '[static] ...#%k ~t\\u2019s m3... [static]',
    '...f1v3... ;;q@@ ...s4ve th3m...',
    "[static] ...he's still here... [static]",
    '...und3r th3 stag3... [static]',
    'AOLF DLYL ULCLY MVBUK. SVVR BUKLY AOL ZAHNL.',
  ],
};
