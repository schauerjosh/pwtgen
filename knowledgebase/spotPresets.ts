import { BehaviorSubject } from "rxjs";

export function buildSpotData(overrides: Partial<SpotData> = {}, attributesToRemove: string[] = []): SpotData {
    const baseData: SpotData = {
        id: Math.floor(Math.random() * 1000000),
        prod_order_id: Math.floor(Math.random() * 100000),
        firm_id: Math.floor(Math.random() * 10000),
        adtype_id: Math.floor(Math.random() * 1000),
        client_id: Math.floor(Math.random() * 1000000),
        spot_title: "Default Title",
        status: "Active",
        metadata: {
            script: "<p>Now I'm going to start typing and I'm still typing but the words haven't shown up just yetkljsdfjsodkfjjkosdf</p>",
            draft_id: 357517,
            soldflag: 1,
            stations: [109488, 109489],
            draftflag: 0,
            created_by: 600920,
            created_on: "2021/01/30 02:41:06",
            createdate: "2021/01/30 02:41:06",
            spot_users: [
                {
                    job_id: "Sales",
                    user_id: 603590,
                    nonAutoJobAssigned: false,
                },
            ],
            spot_length: 59,
            submitted_on: "2021/01/30 02:41:06",
            spot_stations: [
                {
                    stationid: 109488,
                    contractno: "1231232",
                    group_name: "Group A",
                    station_id: 109488,
                },
                {
                    stationid: 109489,
                    contractno: "1231232",
                    group_name: "Group A",
                    station_id: 109489,
                },
            ],
            approval_ability: 0,
            approval_label: '',
            approval_waiting: 0,
            approvespotflag: true,
            rotationpercent: 100,
            uniqueiscigenerated: true,
            spot_files: [
                { file_id: 1, status_code_id: 3, file_name: "valid_file_1.mp4" },
                { file_id: 2, status_code_id: 2, file_name: "invalid_file_2.mp4" },
                { file_id: 3, status_code_id: 3, file_name: "valid_file_3.mp4" },
            ],
            versions: [
                {
                    label: 'Author: Demo Prod Director - 2025-02-21 09:25:21',
                    value: 'First version'
                },
                {
                    label: 'Author: Demo Prod Director - 2025-02-22 09:25:21',
                    value: 'Second version'
                }
            ]
        },
        toggle$: new BehaviorSubject<boolean>(true),
    };

    // Apply overrides
    const spotData = { ...baseData, ...overrides };

    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj: any = spotData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) return; // Break early if path doesn't exist
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });

    return spotData;
}

// Move spotPresets.ts to src/ for proper import
// Spot data presets
export const spotPresets = {
    valid: buildSpotData()
};

// Types for spot data
export interface SpotData {
    id: number;
    prod_order_id: number;
    firm_id: number;
    adtype_id: number;
    client_id: number;
    spot_title: string | null;
    status: string;
    metadata: SpotMetaData;
    toggle$: BehaviorSubject<boolean>;
}

export interface SpotMetaData {
    file_type?: string;
    script?: string;
    draft_id?: number;
    soldflag?: number;
    stations?: number[];
    draftflag?: number;
    created_by?: number;
    created_on?: string;
    createdate?: string;
    spot_users?: Array<{
        job_id?: string;
        user_id?: number;
        nonAutoJobAssigned?: boolean;
    }>;
    spot_length?: number;
    submitted_on?: string;
    spot_stations?: Array<{
        stationid?: number;
        contractno?: string;
        group_name: string;
        station_id?: number;
    }>;
    approval_ability?: number;
    approval_waiting?: number;
    approval_label?: string;
    approvespotflag?: boolean;
    approvescriptflag?: boolean;
    rotationpercent?: number;
    spot_files?: Array<{
        file_id?: number;
        status_code_id?: number;
        file_name?: string;
    }>;
    versions?: Array<{
        label: string;
        value: string;
    }>;
    uniqueiscigenerated?: boolean;
}
