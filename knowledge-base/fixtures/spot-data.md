---
type: fixture
category: spot-data
---

# Spot Data Fixtures

## Valid Spot Data
```typescript
export const validSpotData = {
  adType: "Radio Commercial",
  client: "Dairy Queen - Taber", 
  title: "JS - PLAYWRIGHT TEST",
  length: "30",
  rotation: "100",
  isci: "1234",
  status: "Needs Producing",
  contract: "12312322",
  station: "CHBW-FM B94",
  script: "<p>Sample script content for testing purposes</p>",
  approvalRequired: true
};
```

## Spot Metadata Structure
```typescript
export interface SpotMetadata {
  script?: string;
  draft_id?: number;
  soldflag?: number;
  stations?: number[];
  draftflag?: number;
  created_by?: number;
  created_on?: string;
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
  approvespotflag?: boolean;
  rotationpercent?: number;
  spot_files?: Array<{
    file_id?: number;
    status_code_id?: number;
    file_name?: string;
  }>;
}
```

## File Upload Test Data
```typescript
export const testFiles = {
  validAudio: "test-audio.mp3",
  validVideo: "test-video.mp4", 
  validImage: "test-image.jpg",
  invalidFormat: "test-file.txt",
  largeFile: "large-video.mov"
};
```

## Station Data
```typescript
export const testStations = [
  {
    id: 109488,
    name: "CHBW-FM B94",
    contractPrefix: "CHBW",
    group: "Group A"
  },
  {
    id: 109489, 
    name: "CKUA-FM",
    contractPrefix: "CKUA",
    group: "Group A"
  }
];
```

## Ad Types
```typescript
export const adTypes = [
  "Radio Commercial",
  "TV Commercial", 
  "Digital Ad",
  "Print Ad",
  "Social Media Post"
];
```

## Status Options
```typescript
export const statusOptions = [
  "Draft",
  "Needs Producing",
  "In Production", 
  "Needs Approval",
  "Approved",
  "Scheduled",
  "Aired",
  "Archived"
];
```
