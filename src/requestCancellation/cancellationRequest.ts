export interface ICancellationCommand {
  execute(): Promise<any>;
  undo(): Promise<void>;
  getAuditInfo(): any;
}

export abstract class CancellationCommand implements ICancellationCommand {
  protected orderId: string;
  protected productId: string;
  protected reason: string | undefined;
  protected startTime: Date;
  
  constructor(orderId: string, productId: string, reason?: string) {
    this.orderId = orderId;
    this.productId = productId;
    this.reason = reason;
    this.startTime = new Date();
  }

  abstract execute(): Promise<any>;
  
  async undo(): Promise<void> {
    console.log(`undoing cancellation for order ${this.orderId}, product ${this.productId}`);
  }

  getAuditInfo(): any {
    return {
      orderId: this.orderId,
      productId: this.productId,
      reason: this.reason ?? null,
      executedAt: this.startTime,
      commandType: this.constructor.name
    };
  }
}

export class CancellationCommandInvoker {
  private executedCommands: ICancellationCommand[] = [];

  async executeCommand(command: ICancellationCommand): Promise<any> {
    try {
      console.log('executing cancellation command:', command.getAuditInfo());
      
      const result = await command.execute();
      this.executedCommands.push(command);
      
      console.log('cancellation command completed successfully');
      return result;
      
    } catch (error) {
      console.error('cancellation command failed:', error);
      
      try {
        await command.undo();
      } catch (undoError) {
        console.error('failed to undo cancellation command:', undoError);
      }
      
      throw error;
    }
  }

  async retryFailedCommands(): Promise<void> {
    console.log('retry mechanism not implemented in this demo');
  }

  getAuditTrail(): any[] { // not implemented audit viewing in console nor frontend
    return this.executedCommands.map(cmd => ({
      ...cmd.getAuditInfo(),
      executedAt: new Date()
    }));
  }

  clearAuditTrail(): void { // since not implemented, also not in use
    this.executedCommands = [];
  }
}