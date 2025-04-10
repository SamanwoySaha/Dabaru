export type TimeControlConfig = {
    label: string;
    baseTime: number;
    increment: number;
};

export type TimeControlPresets = {
    BULLET1: TimeControlConfig;
    BULLET2: TimeControlConfig;
    BLITZ1: TimeControlConfig;
    BLITZ2: TimeControlConfig;
    BLITZ3: TimeControlConfig;
    BLITZ4: TimeControlConfig;
    RAPID1: TimeControlConfig;
    RAPID2: TimeControlConfig;
    RAPID3: TimeControlConfig;
    CLASSICAL1: TimeControlConfig;
    CLASSICAL2: TimeControlConfig;
};

export const timeConfig: TimeControlPresets = {
    BULLET1: {
        label: "1+0 Bullet",
        baseTime: 60,
        increment: 0,
    },
    BULLET2: {
        label: "2+1 Bullet",
        baseTime: 120,
        increment: 1,
    },
    BLITZ1: {
        label: "3+0 Blitz",
        baseTime: 180,
        increment: 0,
    },
    BLITZ2: {
        label: "3+2 Blitz",
        baseTime: 180,
        increment: 2,
    },
    BLITZ3: {
        label: "5+0 Blitz",
        baseTime: 300,
        increment: 0,
    },
    BLITZ4: {
        label: "5+3 Blitz",
        baseTime: 300,
        increment: 3,
    },
    RAPID1: {
        label: "10+0 Rapid",
        baseTime: 600, 
        increment: 0, 
    },
    RAPID2: {
        label: "10+5 Rapid",
        baseTime: 600,
        increment: 5, 
    },
    RAPID3: {
        label: "15+10 Rapid",
        baseTime: 900,
        increment: 10, 
    },
    CLASSICAL1: {
        label: "30+0 Classical",
        baseTime: 1800, 
        increment: 0, 
    },
    CLASSICAL2: {
        label: "30+20 Classical",
        baseTime: 1800, 
        increment: 20, 
    },
};
