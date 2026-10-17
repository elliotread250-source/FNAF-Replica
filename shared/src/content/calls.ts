// Phone calls. All original writing; placeholders are filled through the roster so original mode swaps names.
export interface CallLine {
  /** Seconds from call start. */
  t: number;
  text: string;
  /** Scripted synthesised sound cue instead of speech. */
  cue?: 'banging' | 'musicbox' | 'groan' | 'screech' | 'static' | 'garble';
}

export interface CallDef {
  night: number;
  lines: CallLine[];
  duration: number;
}

const N1 = [
  'Hey! Hello, hi. Okay, is this thing recording? Yeah. Okay.',
  "Welcome to the night shift at {venue}, Location Seven! I'm the day manager, and I've been asked to leave you all a few, uh, orientation notes.",
  "Since there's four of you this year. Which is new. Corporate's never staffed four guards before. Don't read into that.",
  "So. You've each got a station. Doors, lights, a camera tablet.",
  "The building's on one power supply, a shared one, so, uh, be polite with it.",
  "If one of you leaves your camera up all night, the rest of you are going to be sitting in the dark around five, and nobody wants that. Especially you. Trust me.",
  "Now, the characters. {leader}, {rabbit}, {bird}, and our pirate pal {fox} back in the cove.",
  "They're, uh, they're on a free-roam mode at night. Something about the servos locking up if they stand still too long. They wander. It's fine. Mostly.",
  "There is, um. There's a thing I'm required to read.",
  "'By accepting this position, staff acknowledge that {company} carries no liability for any injury, disappearance, or, uh, reassignment that occurs after closing.",
  "Incident paperwork will be processed once the affected area has been fully sanitised and refurnished.' Refurnished. Okay. Lawyers, right?",
  "Here's the honest version. The characters don't really get people at night. Their facial recognition wasn't built for that.",
  "They might see one of you and think you're a bare endoskeleton without a costume on, and that's against the rules here, so they'll try to, uh, help you into one.",
  'And the costumes are full of crossbeams and wiring. So. That would be uncomfortable. Briefly.',
  'So close your door if one of them is standing at it. Use the lights to check. Use the cameras, but take turns, okay? Talk to each other.',
  "That's literally the whole job. Talk, look, close doors, and don't waste power.",
  "Alright. Good luck, you four. I'll check in tomorrow. Probably.",
];

const N2 = [
  "Hey, hello! You all made it to night two! Great. I mean that. Last year's guy didn't, uh. Never mind.",
  "So, things get a little busier from here. {rabbit} and {bird} get, let's say, more curious. They'll come right up to your doors.",
  "The window lights are your best friend. If you flip a light on and someone's standing there, shut the door, wait, and they'll lose interest eventually.",
  "One more thing. If one of them gets inside your office, and you notice your buttons don't respond, that's, uh. That's bad.",
  "Don't pull your tablet up. Actually, it doesn't matter what you do at that point.",
  "Just know that the rest of the team still has a shot, so, keep talking to them. Even if you're, you know. Spiritually.",
  "Oh! And {fox}. The pirate. He doesn't like being watched, but he also doesn't like being ignored.",
  "Check the cove every so often. If he's gone, the West station needs to slam that door fast, because he sprints. Like, sprints. You'll hear it.",
  'Also, the West station has a flashlight now. Corporate sent one after the, um, incident.',
  "If you catch him early in the hall with it, he gets embarrassed and goes back. That's my professional theory.",
  'Okay. Talk soon!',
];

const N3 = [
  "Hello, hey, night three, look at you four! You're practically veterans. I'm proud, genuinely. I've got a feeling you're the team that makes it.",
  "So starting tonight, the Technician, Control Room, you've got a music box to wind. There's a, uh, a prize-corner attraction. Sits in a box.",
  "It's been here longer than me. It doesn't do much as long as the music keeps playing, so just keep it wound. If it stops, um. Wind it faster, I guess.",
  "And everybody else, you can wind it from the Prize Corner camera if you have to, but it's slower from your end.",
  "The building also has some, let's call them, maintenance quirks. Cameras drop out, the vents act up, the door controls stick.",
  "Technician, you've got the panel. Reboot what breaks. If the vents go down for too long, people start seeing things.",
  "Don't panic about the things you see. Panic about the things that are actually there. Ha. Sorry.",
  "And, uh. {leader}. He's going to start moving now. He likes the dark.",
  "He doesn't move when you're watching him, which is great, but watching costs power, which is not great. Work it out between you.",
  "Oh, and if anybody sees a gold bear somewhere he shouldn't be, just, put your tablet up. Don't ask why. I don't know why. Okay, bye!",
];

const N4 = [
  "Uh, hello? Hey. Hi. Listen, if you're hearing this and you're all at your stations, great, I had a feeling you'd make it. Um.",
  "I'm, uh, I might not be around to record these much longer. It's been a rough night here.",
  "I'm recording this from the back, I think something's been banging on the door for a while. Yeah.",
  "I don't know if it's {leader} or the pirate. I keep hearing a little song.",
  "So I want to make sure you four know the important stuff. Stay together. I mean, you can't, physically, but on the radio.",
  'When one of you goes quiet, the others have to cover. Share the power. Technician, use the routing boost, it\'s there for a reason.',
  'South station, the mask works on some of them. Not all of them. Not the fox.',
  "If I don't record tomorrow's message, um, there's a key taped under the Backstage workbench. It opens the parts locker.",
  "I never got around to looking in there. Somebody should. I'm going to sit tight and hope the banging stops on its own.",
];

function timed(lines: string[], start = 3): CallLine[] {
  let t = start;
  return lines.map((text) => {
    const line = { t, text };
    t += Math.max(2.5, text.split(/\s+/).length / 2.7) + 0.4;
    return line;
  });
}

function withEnding(lines: CallLine[]): CallLine[] {
  const end = lines[lines.length - 1];
  let t = end.t + Math.max(2.5, end.text.split(/\s+/).length / 2.7) + 1;
  const extra: CallLine[] = [
    { t, text: '[banging]', cue: 'banging' },
    { t: (t += 3), text: 'Oh, no...' },
    { t: (t += 2), text: '[music box]', cue: 'musicbox' },
    { t: (t += 5), text: '[groan]', cue: 'groan' },
    { t: (t += 2), text: '[screech]', cue: 'screech' },
    { t: (t += 1.5), text: '[static]', cue: 'static' },
  ];
  return [...lines, ...extra];
}

// Night 5: garbled transmission. A Caesar shift of 7 hides a message in the subtitle data.
export const NIGHT5_CIPHER = 'AOLF DLYL ULCLY MVBUK. SVVR ILOPUK AOL ZAHNL.';

export function caesar(text: string, shift: number): string {
  return text.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + shift + 26) % 26) + 65));
}

const N5: CallLine[] = [
  { t: 0, text: '[static]', cue: 'static' },
  { t: 3, text: '▓▒░ ▒▓ ░░▒▓▒ ▓▒', cue: 'garble' },
  { t: 6, text: '░▒...it\'s me...▒▓' },
  { t: 9, text: '▒▓▓░ ▒░ ▓▒░▒ ░▓', cue: 'garble' },
  { t: 12, text: '▓░...five...░▒▓' },
  { t: 15, text: '░▒▓▒ ▓░▒ ' + NIGHT5_CIPHER.slice(0, 4) + ' ▒░▓', cue: 'garble' },
  { t: 18, text: '▒...save them...▓░' },
  { t: 21, text: '░▓...he\'s still here...▒' },
  { t: 25, text: '[static]', cue: 'static' },
];

const n1 = timed(N1);
const n2 = timed(N2);
const n3 = timed(N3);
const n4 = withEnding(timed(N4));

function dur(lines: CallLine[]): number {
  const l = lines[lines.length - 1];
  return Math.ceil(l.t + Math.max(2.5, l.text.split(/\s+/).length / 2.7) + 1);
}

export const CALLS: Record<number, CallDef> = {
  1: { night: 1, lines: n1, duration: dur(n1) },
  2: { night: 2, lines: n2, duration: dur(n2) },
  3: { night: 3, lines: n3, duration: dur(n3) },
  4: { night: 4, lines: n4, duration: dur(n4) },
  5: { night: 5, lines: N5, duration: 28 },
};

/** Full cipher data, for the dataminers. */
export const NIGHT5_HIDDEN = { cipher: NIGHT5_CIPHER, shift: 7 };

export const CUSTOM_NIGHT_NOTE =
  "Hey! This one's off the books. Corporate doesn't know about it, so if anybody asks, you were never here.";

// Classic Office calls are written for one guard.
const C1 = [
  'Hello, hello? Uh, hi. Welcome to your first night at {venue}.',
  "I'm the day manager. I worked nights before you, so I figured I'd leave you a few notes.",
  "You've got two doors, two lights, and a camera tablet. And a power supply that does not like you very much. Use it carefully.",
  "The characters wander at night. They're not mean. They just get confused about who's wearing a costume and who isn't.",
  "If one of them is standing at your door when you flip the light on, close the door. Wait. They'll get bored.",
  "The fox, {fox}, stays in his cove. Mostly. Look in on him now and then, but don't stare.",
  "That's it. Six hours. You'll be fine. Probably. Goodnight!",
];

export const CLASSIC_CALLS: Record<number, CallDef> = {
  1: { night: 1, lines: timed(C1), duration: dur(timed(C1)) },
  2: CALLS[2],
  3: CALLS[3],
  4: CALLS[4],
  5: CALLS[5],
};
