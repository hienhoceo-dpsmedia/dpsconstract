export interface TestClock {
  now: () => Date;
  set: (dateOrIso: string | Date) => void;
  advance: (ms: number) => void;
  reset: () => void;
}

export function createTestClock(initialTime: string | Date = new Date()): TestClock {
  let currentTime = new Date(initialTime).getTime();
  const startTime = currentTime;

  return {
    now: () => new Date(currentTime),
    set: (dateOrIso: string | Date) => {
      currentTime = new Date(dateOrIso).getTime();
    },
    advance: (ms: number) => {
      currentTime += ms;
    },
    reset: () => {
      currentTime = startTime;
    },
  };
}

