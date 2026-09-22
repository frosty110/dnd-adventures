import type { SceneId } from "@dnd-adventures/shared-types";

/**
 * MiniMax video generation prompts keyed by scene ID.
 *
 * ── Visual Style: "Illustrated Dark Fantasy" ──
 *
 * Art direction: Hand-painted dark fantasy illustration in the tradition
 * of classic D&D module cover art and fantasy concept art. Rich oil-paint
 * textures with visible brushwork, deep shadows, warm accent lighting,
 * and a muted earth-tone palette punctuated by saturated magical hues.
 * NOT photorealistic — stylized painterly rendering throughout.
 *
 * Color palette: Deep umbers, charcoal blacks, burnt sienna, muted golds,
 * desaturated greens and blues. Magic and fire provide the only saturated
 * color — arcane violet, ember orange, spectral teal.
 *
 * Perspective: First-person point of view. The viewer IS the adventurer.
 * The camera represents the player's eyes looking directly at the scene.
 * No third-person framing, no "watching from across the room."
 *
 * Motion: Ambient and environmental only — flickering firelight, drifting
 * fog, swaying foliage, floating particles. The world breathes around
 * the viewer. No camera movement, no character animation.
 *
 * Purpose: Immersive ambient backgrounds. These are living illustrations
 * that surround the player, not captured footage of events.
 *
 * Format: 5-second seamless loops, locked static frame.
 */
export const SCENE_PROMPTS: Record<SceneId, string> = {
  tavern_idle:
    "Hand-painted dark fantasy illustration, first person point of view looking across a dim tavern common room. Oil-paint textures, visible brushwork, muted earth tones. Warm firelight flickers gently across wooden beams and a stone hearth ahead, low flames dancing subtly, faint smoke drifting upward. A tankard sits on the table in front of you, liquid barely rippling. Painterly style, 5 second seamless loop",
  tavern_tense:
    "Hand-painted dark fantasy illustration, first person point of view looking at two figures locked in a tense standoff across a tavern table. Oil-paint textures, visible brushwork, dramatic chiaroscuro lighting. Firelight casts deep flickering shadows on their faces, the air feels heavy and still. A patron in the periphery slowly looks away. Painterly style, 5 second seamless loop",
  goblin_ambush:
    "Hand-painted dark fantasy illustration, first person point of view looking directly at goblins bursting through a wooden door ahead. Oil-paint textures, visible brushwork, chaotic warm torchlight. Green-skinned creatures with rusted weapons lunging toward you, wood splinters drifting slowly through the air, dust particles floating in torchlight. Painterly style, 5 second seamless loop",
  combat_melee:
    "Hand-painted dark fantasy illustration, first person point of view looking down your extended sword blade clashing against an opponent's weapon in a stone dungeon. Oil-paint textures, visible brushwork, dramatic torch-lit contrast. Bright sparks slowly cascade from the contact point, torchlight flickers on wet stone walls. Painterly style, 5 second seamless loop",
  cave_entrance:
    "Hand-painted dark fantasy illustration, first person point of view looking into a dark cave mouth in a forested hillside. Oil-paint textures, visible brushwork, deep greens and blacks. Eerie mist slowly rolls out of the darkness toward you, twisted tree branches sway gently, moonlight filters through drifting clouds above. Painterly style, 5 second seamless loop",
  cave_interior:
    "Hand-painted dark fantasy illustration, first person point of view looking down a narrow underground tunnel stretching ahead into darkness. Oil-paint textures, visible brushwork, deep blues and blacks. Water drops fall slowly from stalactites above, faint bioluminescent glow pulses gently on cave walls, the passage disappears into shadow. Painterly style, 5 second seamless loop",
  npc_dialogue:
    "Hand-painted dark fantasy illustration, first person point of view looking directly at a gruff dwarf barkeep behind a wooden counter, meeting your gaze. Oil-paint textures, visible brushwork, warm tavern tones. Braided beard, dim firelight flickering across his weathered face, atmospheric dust motes drifting in warm light between you. Painterly style, 5 second seamless loop",
  forest_path:
    "Hand-painted dark fantasy illustration, first person point of view looking down a winding path through a dark ancient forest stretching ahead. Oil-paint textures, visible brushwork, deep greens and silvers. Gnarled tree branches sway gently in breeze on either side, fog drifts slowly between trunks, faint moonlight casts long shadows on the ground before you. Painterly style, 5 second seamless loop",
  town_street:
    "Hand-painted dark fantasy illustration, first person point of view looking down a medieval town street at night stretching into the distance. Oil-paint textures, visible brushwork, warm lantern golds against deep blues. Cobblestones underfoot, hanging lantern flames sway gently, warm pools of light fall on half-timbered buildings, faint mist drifts at ground level. Painterly style, 5 second seamless loop",
  campfire:
    "Hand-painted dark fantasy illustration, first person point of view looking at a campfire directly ahead in a forest clearing at night, as if sitting beside it. Oil-paint textures, visible brushwork, warm oranges against deep blacks. Flames crackle and dance, embers float slowly upward, bedrolls and gear visible in the warm glow, dark trees surround the clearing. Painterly style, 5 second seamless loop",
  treasure_found:
    "Hand-painted dark fantasy illustration, first person point of view looking down at a glowing magical artifact revealed in an ornate chest before you in a dark stone chamber. Oil-paint textures, visible brushwork, golden light against deep shadows. Radiant light spills upward from the chest onto your hands, dust particles drift lazily through the light beams. Painterly style, 5 second seamless loop",
  magic_spell:
    "Hand-painted dark fantasy illustration, first person point of view looking at your outstretched hands as arcane magical energy swirls around them. Oil-paint textures, visible brushwork, saturated violet and teal against dark atmospheric background. Glowing runes orbit slowly, faint particle effects drift gently between your fingers. Painterly style, 5 second seamless loop",
  fireball:
    "Hand-painted dark fantasy illustration, first person point of view looking at a fireball erupting from your outstretched palm into a stone dungeon chamber ahead. Oil-paint textures, visible brushwork, intense orange and red against dark stone. Flames expand outward, faint heat distortion shimmers slowly, embers float through the air. Painterly style, 5 second seamless loop",
  stealth:
    "Hand-painted dark fantasy illustration, first person point of view peering around a stone corridor corner into deep shadow ahead. Oil-paint textures, visible brushwork, extreme contrast between moonlit beams and inky darkness. Moonlight cuts through narrow windows, dust motes drift in the pale shafts of light, the corridor stretches into blackness. Painterly style, 5 second seamless loop",
  trap_danger:
    "Hand-painted dark fantasy illustration, first person point of view looking at an ancient trap mechanism activating in the dungeon corridor directly ahead. Oil-paint textures, visible brushwork, urgent warm tones against cold stone. Arrows suspended mid-flight from wall slots at eye level, stone dust falls slowly from the ceiling, a pressure plate is visible on the floor before you. Painterly style, 5 second seamless loop",
  locked_door:
    "Hand-painted dark fantasy illustration, first person point of view looking at a massive ornate door directly ahead, covered in ancient runes that pulse with faint light. Oil-paint textures, visible brushwork, mysterious arcane glow against dark stone. Huge iron hinges frame a gothic stone archway, spectral light gently seeps and flickers through the door cracks toward you. Painterly style, 5 second seamless loop",
  rain_storm:
    "Hand-painted dark fantasy illustration, first person point of view looking out across a medieval town from beneath a rain-battered overhang at night. Oil-paint textures, visible brushwork, cool blues and silvers. Heavy rain streaks down ahead, distant lightning briefly illuminates stone buildings, puddles ripple on cobblestones below, dark storm clouds churn overhead. Painterly style, 5 second seamless loop",
  victory:
    "Hand-painted dark fantasy illustration, first person point of view looking up at epic golden rays breaking through parting storm clouds above a battlefield. Oil-paint textures, visible brushwork, triumphant golden hour warmth. Your raised sword catches the light at the bottom of frame, dramatic beams illuminate the scene, dust and embers drift upward. Painterly style, 5 second seamless loop",
  defeat:
    "Hand-painted dark fantasy illustration, first person point of view looking down at the ground from a kneeling position, a broken weapon lying before you. Oil-paint textures, visible brushwork, somber muted tones, fading light. Dust settles slowly around you, a single ember drifts upward from scorched earth, shadows close in at the edges. Painterly style, 5 second seamless loop",
  potion_drink:
    "Hand-painted dark fantasy illustration, first person point of view looking down at glowing potion bottles on an alchemist table before you, one held in your hand. Oil-paint textures, visible brushwork, jewel-toned liquids against dark wood. Bottles bubble gently with luminous contents, wisps of vapor rise slowly from an open flask, mysterious ambient light shifts subtly. Painterly style, 5 second seamless loop",
  bridge_crossing:
    "Hand-painted dark fantasy illustration, first person point of view looking across a narrow stone bridge stretching ahead over a dark bottomless chasm. Oil-paint textures, visible brushwork, vertigo-inducing depth. Rope railings frame either side, faint mist rises slowly from the abyss below, a single torch flame flickers gently on the far side. Painterly style, 5 second seamless loop",
  throne_room:
    "Hand-painted dark fantasy illustration, first person point of view looking at an imposing empty throne at the far end of a grand dark hall with tall stone pillars. Oil-paint textures, visible brushwork, dramatic scale and gothic architecture. Torchlight casts long flickering shadows on vaulted walls, dust motes drift in shafts of light from high windows. Painterly style, 5 second seamless loop",
  moonrise:
    "Hand-painted dark fantasy illustration, first person point of view looking out at a full moon rising over dark fantasy hills from a hilltop vantage. Oil-paint textures, visible brushwork, silver and deep blue palette. Moonlight illuminates rolling landscape below, silhouetted trees with branches barely swaying, clouds drift very slowly across the luminous moon. Painterly style, 5 second seamless loop",
  merchant:
    "Hand-painted dark fantasy illustration, first person point of view looking at a medieval merchant across their stall, wares spread before you. Oil-paint textures, visible brushwork, warm lantern tones. Colorful potion bottles glow faintly, ornate swords catch lantern light, the merchant slowly looks up to meet your gaze. Painterly style, 5 second seamless loop",
  dice_roll:
    "Hand-painted dark fantasy illustration, first person point of view looking down at a glowing magical d20 die resting on a worn wooden table before you. Oil-paint textures, visible brushwork, warm tavern amber glow. Fantasy runes on the die faces pulse with faint arcane light, subtle particle effects drift around the die, your hands rest at the edge of frame. Painterly style, 5 second seamless loop",
};
