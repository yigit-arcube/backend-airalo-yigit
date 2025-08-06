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
  
  // base undo implementation can be overridden by specific commands
  async undo(): Promise<void> {
    console.log(`undoing cancellation for order ${this.orderId}, product ${this.productId}`);
  }

  // standard audit information all commands should provide
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

// command invoker of cancellation commands(from user, admin or B2B partner, with fraud detection(?))
export class CancellationCommandInvoker {
  private executedCommands: ICancellationCommand[] = [];

  // execute a cancellation command with error handling and audit trail
  async executeCommand(command: ICancellationCommand): Promise<any> {
    try {
      console.log('executing cancellation command:', command.getAuditInfo());
      
      const result = await command.execute();
      this.executedCommands.push(command);
      
      console.log('cancellation command completed successfully');
      return result;
      
    } catch (error) {
      console.error('cancellation command failed:', error);
      
      // attempt to undo any partial changes
      try {
        await command.undo();
      } catch (undoError) {
        console.error('failed to undo cancellation command:', undoError);
      }
      
      throw error;
    }
  }

  // retry failed commands with exponential backoff
  async retryFailedCommands(): Promise<void> {
    // this would typically be called by a scheduled job
    console.log('retry mechanism not implemented in this demo');
  }

  // get audit trail of all executed commands
  getAuditTrail(): any[] {
    return this.executedCommands.map(cmd => ({
      ...cmd.getAuditInfo(),
      executedAt: new Date()
    }));
  }

  // clear audit trail for testing purposes
  clearAuditTrail(): void {
    this.executedCommands = [];
  }
}