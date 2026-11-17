import { matchKnowledgeTopic, AI_UNAVAILABLE_MESSAGE, AI_BUSY_MESSAGE } from '../../src/services/aiCopilot/offlineAnswers';

const TOPICS = ['fever', 'vomiting', 'lameness', 'diarrhea', 'coughing', 'weight_loss', 'skin', 'vaccination', 'nutrition', 'breeding'];

describe('AI assistant - what it recognises with no AI provider', () => {
  it('understands the question that got no answer: "my Baxter\'s is having feer, what to do"', () => {
    expect(matchKnowledgeTopic("my Baxter's is having feer, what to do", TOPICS)).toBe('fever');
  });

  it.each([
    ['my cow has a high temperature', 'fever'],
    ['dog is vommiting since morning', 'vomiting'],
    ['goat is limping on the back leg', 'lameness'],
    ['calf has loose motion', 'diarrhea'],
    ['calf has diarrhoea', 'diarrhea'],
    ['my cat keeps coughing', 'coughing'],
    ['losing weight fast', 'weight_loss'],
    ['when is the next vaccine due', 'vaccination'],
  ])('"%s" -> %s', (text, topic) => {
    expect(matchKnowledgeTopic(text, TOPICS)).toBe(topic);
  });

  it('does not guess when nothing matches, or on short words that are merely close', () => {
    expect(matchKnowledgeTopic('what is the weather today', TOPICS)).toBeNull();
    expect(matchKnowledgeTopic('what breed is Baxter', TOPICS)).toBeNull();
    expect(matchKnowledgeTopic('he has a cut', TOPICS)).toBeNull();
  });
});

describe('AI assistant - what a person reads when it cannot answer', () => {
  it.each([['unavailable', AI_UNAVAILABLE_MESSAGE], ['busy', AI_BUSY_MESSAGE]])(
    'the "%s" message never shows developer setup, and says what to do next',
    (_name, text) => {
      expect(text).not.toMatch(/\.env|API_KEY|GROQ|OPENAI|backend|restart|billing|console\./i);
      expect(text).toMatch(/Find a doctor/);
      expect(text).toMatch(/emergency/i);
    },
  );
});
