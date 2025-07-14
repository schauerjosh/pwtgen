export function buildSpotVoiceData(overrides = {}, attributesToRemove = []) {
    const baseData = {
        id: Math.floor(Math.random() * 1000000),
        created_on: '2024-12-04 02:28:26',
        dates_differ: false,
        due_date: '2025-12-04 02:28:26',
        firm_id: Math.floor(Math.random() * 10000),
        length: Math.floor(Math.random() * 10),
        metadata: {
            auditions: [
                {
                    creation_date: '',
                    creation_user_id: Math.floor(Math.random() * 100000),
                    file_desc: '',
                    file_type_id: Math.floor(Math.random() * 100000),
                    original_file_name: '',
                    s3_filename: '',
                    s3_location: '',
                    status_code_id: 3,
                    type: '',
                }
            ],
            cat_names: 'Male',
            categories: [1],
            createdby: Math.floor(Math.random() * 100000),
            hide_voice: false,
            isredo: null,
            requester_name: 'Demo Prod Director',
            search_type: 3,
            spot_client: 'Boardwalk Billy\'s',
            spot_isci: 'Test',
            spot_title: 'Test',
            talent_ids: [Math.floor(Math.random() * 100000)],
            talent_pool_name: 'Demo Voice Pool',
            updated_on: '2025-18-02 02:28:26'
        },
        notes: '',
        parent_request_id: 0,
        part: 'test',
        request_user_id: -1,
        spot_id: Math.floor(Math.random() * 1000000),
        status_code_id: 312,
        talent_pool_id: 3,
        voice_user_id: -1
    };
    // Apply overrides
    const spotVoiceData = { ...baseData, ...overrides };

    // Remove specified attributes
    attributesToRemove.forEach(attribute => {
        const keys: string[] = (attribute as string).split('.');
        let obj: any = spotVoiceData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) {
                return;
            }
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });

    return spotVoiceData;
}

export const spotVoiceValid = buildSpotVoiceData();

export interface SpotVoiceData {
    id: number;
    created_on: string;
    dates_differ: boolean;
    due_date: string;
    firm_id: number;
    length: number;
    metadata: any;
    notes: string;
    parent_request_id: number;
    part: string;
    request_user_id: number;
    spot_id: number;
    status_code_id: number;
    talent_pool_id: number;
    voice_user_id: number;
}
