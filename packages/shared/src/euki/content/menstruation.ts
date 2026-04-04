// Euki reproductive health content — bundled from Euki-iOS open-source project
// Source: https://github.com/Euki-Inc/Euki-iOS (GPL-3.0)
// Content adapted for offline use in Locket. See NOTICE at repo root.

import type { EukiContent } from '../types.js';

export const menstruationContent: EukiContent = {
  sections: [
    {
      id: 'menstrual_phase',
      title: 'During Your Period',
      items: [
        {
          id: 'menstrual_what_happens',
          title: 'What happens during your period?',
          body: 'Your uterus sheds its lining when a fertilized egg has not implanted. Hormone levels of estrogen and progesterone drop, signaling the uterine lining to break down. This process typically lasts 3–7 days.',
          links: [{ label: 'Learn more on Euki', url: 'https://eukiapp.com' }],
        },
        {
          id: 'menstrual_cramps',
          title: 'Why do cramps happen?',
          body: 'Cramps (dysmenorrhea) are caused by prostaglandins — hormone-like chemicals that cause the uterus to contract to expel its lining. Higher prostaglandin levels mean stronger cramps. Heat, gentle movement, and NSAIDs can help reduce pain.',
          links: [{ label: 'Pain relief options', url: 'https://eukiapp.com/pain' }],
        },
        {
          id: 'menstrual_bloating',
          title: 'Why does bloating happen before and during your period?',
          body: 'Hormonal changes — particularly a drop in progesterone — can cause water retention and bloating in the days before and during your period. Reducing salt intake and staying hydrated can help manage symptoms.',
        },
        {
          id: 'menstrual_nausea',
          title: 'Period nausea and fatigue',
          body: 'Prostaglandins can affect the digestive system, causing nausea. Combined with blood loss and hormonal shifts, fatigue is also common. Iron-rich foods and gentle movement can support energy levels.',
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
          body: 'Starting on the first day of your period and lasting until ovulation, the follicular phase is when follicle-stimulating hormone (FSH) prompts follicles in your ovaries to grow. Rising estrogen thickens the uterine lining and you may feel more energetic.',
        },
        {
          id: 'follicular_mood',
          title: 'Mood and energy in the follicular phase',
          body: 'Rising estrogen is associated with improved mood, increased energy, and sharper focus. Many people find this phase a good time for social activities, exercise, and tackling new projects.',
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
          body: 'A surge in luteinizing hormone (LH) triggers the release of a mature egg from the dominant follicle. The egg travels down the fallopian tube toward the uterus. This window — typically 24–36 hours — is when pregnancy is most likely.',
        },
        {
          id: 'ovulatory_signs',
          title: 'Signs of ovulation',
          body: 'Common signs include a change in cervical mucus (clearer and more slippery, like egg whites), a slight rise in basal body temperature, mild pelvic discomfort (mittelschmerz), and increased libido.',
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
          body: 'After ovulation, the ruptured follicle becomes the corpus luteum, which produces progesterone to prepare the uterine lining for a potential fertilized egg. If pregnancy does not occur, the corpus luteum breaks down, progesterone drops, and your period begins.',
        },
        {
          id: 'luteal_pms',
          title: 'Why do PMS symptoms happen?',
          body: 'Premenstrual syndrome (PMS) symptoms — including mood changes, breast tenderness, bloating, and irritability — are caused by the hormonal fluctuations in the luteal phase, particularly the decline in estrogen and progesterone before your period.',
        },
        {
          id: 'luteal_mood',
          title: 'Mood in the luteal phase',
          body: 'Progesterone has a calming but sometimes sedating effect. Some people feel more anxious, irritable, or low in mood as progesterone drops toward the end of the phase. Gentle exercise, sleep, and reducing caffeine can help.',
        },
        {
          id: 'luteal_acne',
          title: 'Premenstrual acne',
          body: 'Rising progesterone stimulates sebum (oil) production in the skin, which can clog pores and trigger breakouts in the days before your period. Hormonal fluctuations, not just skincare habits, are the primary driver.',
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
          body: 'The same prostaglandins that cause uterine cramps can also cause referred pain in the lower back. The uterus sits close to lumbar nerves, so contractions can create a dull ache or spasms. Heat therapy and gentle stretching are commonly helpful.',
        },
        {
          id: 'symptom_headache',
          title: 'Menstrual headaches',
          body: 'Estrogen withdrawal before your period is a common headache trigger. These "menstrual migraines" typically occur in the 2 days before to 3 days into your period. Staying hydrated and maintaining sleep patterns can reduce frequency.',
        },
        {
          id: 'symptom_mood_anxious',
          title: 'Anxiety around your period',
          body: 'Fluctuations in estrogen and progesterone affect neurotransmitters like serotonin and GABA, which regulate anxiety. It is normal to experience heightened anxiety in the late luteal phase. Tracking symptoms over cycles helps identify patterns.',
        },
        {
          id: 'symptom_mood_irritable',
          title: 'Irritability and your cycle',
          body: 'Irritability in the premenstrual phase is linked to falling progesterone and estrogen levels affecting serotonin pathways. Naming the pattern — "this might be hormonal" — can reduce its impact on daily life.',
        },
      ],
    },
  ],
};
