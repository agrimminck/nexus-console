export type Stack = "jest" | "vitest" | "pytest" | "godot";
export type Status = "pass" | "fail" | "pending" | "running" | "skip";

export interface IndividualTest {
  id: string;
  name: string;
  status: Status;
  duration?: number;
}

export interface TestFile {
  id: string;
  path: string;
  testCount: number;
  status: Status;
  tests: IndividualTest[];
}

export interface Repo {
  id: string;
  name: string;
  path: string;
  stack: Stack;
  testCount: number;
  status: Status;
  duration?: number;
  files: TestFile[];
  tags: string[];
}

export interface PinnedItem {
  id: string;
  type: "repo" | "file" | "test";
  repoId: string;
  repoName: string;
  repoPath: string;
  stack: Stack;
  label: string;
  status: Status;
  fileId?: string;
  testId?: string;
}

export interface QueueItem {
  id: string;
  type: "repo" | "file" | "test";
  repoId: string;
  repoName: string;
  repoPath: string;
  stack: Stack;
  label: string;
  status: Status;
  fileId?: string;
  testId?: string;
}

export interface ResultToast {
  id: string;
  label: string;
  repoName: string;
  status: "pass" | "fail";
  duration: string;
  exiting: boolean;
}

export interface RunTarget {
  repo_id: string;
  stack: Stack;
  repo_path: string;
  file_id?: string;
  test_id?: string;
  label: string;
  queue_item_id?: string;
}

export interface TerminalLine {
  id: string;
  text: string;
  type: "info" | "pass" | "fail" | "meta" | "raw";
}

export interface DockerFile {
  path: string;
  label: string;
}

export interface RepoResult {
  repoId: string;
  status: Status;
  duration?: number;
}

export interface AppPersisted {
  workers: number;
  queueItems: QueueItem[];
  pinnedItems: PinnedItem[];
  repoResults: RepoResult[];
}
