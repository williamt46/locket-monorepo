// Locket educational health content — original copy authored for Locket.
// Draft pending clinical review before release (see TODOS.md).

import type { HealthContent } from '../types.js';

export const menstruationContent: HealthContent = {
  sections: [
    {
      id: 'menstrual_phase',
      title: 'During Your Period',
      items: [
        {
          id: 'menstrual_what_happens',
          title: 'What happens during your period?',
          body: 'Your period marks the start of a new cycle as the uterine lining is released. Energy often runs lower in these first days, and many people notice cramps, tiredness, or a need for more rest. Periods commonly last around 3–7 days.',
          links: [],
        },
        {
          id: 'menstrual_cramps',
          title: 'Why do cramps happen?',
          body: 'Cramping is linked to the uterus contracting as it releases its lining, and how strong it feels varies a lot from person to person and from cycle to cycle. Many people find warmth, gentle movement, and rest comforting.',
          links: [],
        },
        {
          id: 'menstrual_bloating',
          title: 'Why does bloating happen before and during your period?',
          body: 'Bloating and water retention often come with the hormonal shifts in the days before and during a period. The body can feel heavier or more sensitive during this time, and some people find lighter meals and staying hydrated leave them more comfortable.',
        },
        {
          id: 'menstrual_nausea',
          title: 'Period nausea and fatigue',
          body: 'Queasiness and tiredness are commonly reported in the first days of a period, alongside the hormonal shifts and lower energy of this phase. Many people find rest and gentle movement help them feel more settled.',
        },
      ],
    },
    {
      id: 'follicular_phase',
      title: 'Follicular Phase',
      items: [
        {
          id: 'follicular_what_happens',
          title: 'What is the follicular phase?',
          body: 'The follicular phase runs from the first day of your period up to ovulation. As it progresses, energy and mood often lift, and many people notice feeling more social, focused, and ready to start new things.',
        },
        {
          id: 'follicular_mood',
          title: 'Mood and energy in the follicular phase',
          body: 'The rising energy of the follicular phase is associated with a brighter mood, sharper focus, and more motivation. People often find this a good time for social plans, exercise, and new projects.',
        },
      ],
    },
    {
      id: 'ovulatory_phase',
      title: 'Ovulation',
      items: [
        {
          id: 'ovulatory_what_happens',
          title: 'What happens during ovulation?',
          body: 'Ovulation is the window when an egg is released. Many people notice a peak in energy, confidence, and libido around this time. It is also the phase when the chance of pregnancy is highest.',
        },
        {
          id: 'ovulatory_signs',
          title: 'Signs of ovulation',
          body: 'Around ovulation, some people notice clearer and more slippery cervical fluid, a small rise in basal body temperature, mild pelvic discomfort, or a higher libido.',
        },
      ],
    },
    {
      id: 'luteal_phase',
      title: 'Luteal Phase',
      items: [
        {
          id: 'luteal_what_happens',
          title: 'What is the luteal phase?',
          body: 'The luteal phase is the stretch between ovulation and the next period. Energy often eases back, and many people notice shifts in mood, appetite, or sleep as the phase goes on. If pregnancy does not occur, a new period begins.',
        },
        {
          id: 'luteal_pms',
          title: 'Why do PMS symptoms happen?',
          body: 'Premenstrual (PMS) symptoms, which include mood changes, breast tenderness, bloating, and irritability, accompany the hormonal shifts of the late luteal phase before a new period begins.',
        },
        {
          id: 'luteal_mood',
          title: 'Mood in the luteal phase',
          body: 'The luteal phase is associated with a calming feeling for some people and with more anxiety, irritability, or low mood for others, especially in the days before a period.',
        },
        {
          id: 'luteal_acne',
          title: 'Premenstrual acne',
          body: 'Breakouts in the days before a period often track the hormonal shifts during the luteal phase, which can increase oil production in the skin.',
        },
      ],
    },
    {
      id: 'symptoms',
      title: 'Symptoms & Body Signs',
      items: [
        {
          id: 'symptom_back_pain',
          title: 'Back pain during your period',
          body: 'A dull ache or spasms in the lower back are a common companion to period cramps — the same muscle activity behind cramping can be felt in the back as well. Many people find warmth and gentle stretching comforting.',
        },
        {
          id: 'symptom_headache',
          title: 'Headaches around your period',
          body: 'For many people, headaches cluster around the start of a period, tracking the hormonal dip of the late luteal phase. Steady hydration and regular sleep are often associated with fewer of them.',
        },
        {
          id: 'symptom_mood_anxious',
          title: 'Anxiety around your period',
          body: 'Feeling more anxious in the days before a period is common and is associated with the hormonal shifts of the late luteal phase. Tracking how anxiety moves across your cycles can make the pattern feel more familiar and less alarming.',
        },
        {
          id: 'symptom_mood_irritable',
          title: 'Irritability and your cycle',
          body: 'Irritability before a period is widely reported and tends to follow the hormonal shifts of the late luteal phase. Many people find that recognizing the pattern — "this may be cyclical" — softens its impact on daily life.',
        },
      ],
    },
  ],
};
