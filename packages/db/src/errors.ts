export class InvalidTransition extends Error {
  constructor(
    readonly versionId: string,
    readonly from: string,
    readonly to: string,
    readonly actual?: string,
  ) {
    super(
      actual !== undefined && actual !== from
        ? `invalid transition for version ${versionId}: expected state '${from}' but found '${actual}'`
        : `invalid transition for version ${versionId}: '${from}' → '${to}' is not allowed`,
    );
    this.name = 'InvalidTransition';
  }
}

export class NotFound extends Error {
  constructor(readonly entity: string, readonly id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFound';
  }
}
