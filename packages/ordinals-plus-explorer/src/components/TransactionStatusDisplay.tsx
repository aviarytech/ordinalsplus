import React, { useEffect, useState } from 'react';
import {
  TransactionStatusTracker,
  transactionTracker,
  TransactionStatus,
  TransactionProgressEvent,
  TrackedTransaction,
  TransactionType,
  BitcoinNetwork,
} from 'ordinalsplus';
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';

export interface TransactionStatusDisplayProps {
  transactionId?: string;
  network: BitcoinNetwork;
  tracker?: TransactionStatusTracker;
  onStatusChange?: (status: TransactionStatus) => void;
  onError?: (error: Error) => void;
}

interface StatusItem {
  icon: React.ReactNode;
  message: string;
  timestamp: Date;
  status: TransactionStatus;
  link?: string;
  error?: string;
}

const TransactionStatusDisplay: React.FC<TransactionStatusDisplayProps> = ({
  transactionId,
  network,
  tracker = transactionTracker,
  onStatusChange,
  onError,
}) => {
  const [transaction, setTransaction] = useState<TrackedTransaction | null>(null);
  const [events, setEvents] = useState<TransactionProgressEvent[]>([]);
  const [childTx, setChildTx] = useState<TrackedTransaction | null>(null);
  const [childEvents, setChildEvents] = useState<TransactionProgressEvent[]>([]);

  useEffect(() => {
    if (!transactionId) return;

    const updateStatus = () => {
      try {
        const tx = tracker.getTransaction(transactionId);
        setTransaction(tx || null);
        if (tx) {
          setEvents(tracker.getTransactionProgressEvents(transactionId));
          const children = tracker.getChildTransactions(transactionId);
          if (children.length > 0) {
            setChildTx(children[0]);
            setChildEvents(tracker.getTransactionProgressEvents(children[0].id));
          } else {
            setChildTx(null);
            setChildEvents([]);
          }
          onStatusChange?.(tx.status);
        }
      } catch (err) {
        onError?.(err as Error);
      }
    };

    updateStatus();
    const id = setInterval(updateStatus, 2000);
    return () => clearInterval(id);
  }, [transactionId, tracker, onStatusChange, onError]);

  const createStatusItems = (
    tx: TrackedTransaction,
    progress: TransactionProgressEvent[],
  ): StatusItem[] => {
    const items: StatusItem[] = [];

    const { status, txid, error, lastUpdatedAt } = tx;
    let message = '';
    let icon: React.ReactNode = <Clock className="h-5 w-5 text-gray-400" />;

    switch (status) {
      case TransactionStatus.PENDING:
        message = 'Transaction is being prepared';
        icon = <Clock className="h-5 w-5 text-yellow-500" />;
        break;
      case TransactionStatus.CONFIRMING:
        message = 'Transaction has been sent to the network';
        icon = <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />;
        break;
      case TransactionStatus.CONFIRMED:
        message = 'Transaction has been confirmed';
        icon = <CheckCircle className="h-5 w-5 text-green-500" />;
        break;
      case TransactionStatus.FAILED:
        message = error?.message || 'Transaction failed';
        icon = <XCircle className="h-5 w-5 text-red-500" />;
        break;
      default:
        message = `Transaction status: ${status}`;
        icon = <AlertCircle className="h-5 w-5 text-gray-400" />;
    }

    items.push({
      icon,
      message,
      timestamp: lastUpdatedAt,
      status,
      link: txid ? tracker.getTransactionExplorerUrl(txid, network) : undefined,
      error: error?.message,
    });

    for (const ev of progress) {
      items.push({
        icon: <Clock className="h-4 w-4 text-gray-400" />,
        message: ev.message,
        timestamp: ev.timestamp,
        status,
      });
    }

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const renderItems = (items: StatusItem[]) => (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex gap-3 p-3 border-l-4 rounded-md shadow-sm bg-white dark:bg-gray-800 ${
            item.status === TransactionStatus.CONFIRMED
              ? 'border-green-500'
              : item.status === TransactionStatus.FAILED
                ? 'border-red-500'
                : item.status === TransactionStatus.CONFIRMING
                  ? 'border-indigo-500'
                  : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <div className="flex items-start">{item.icon}</div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-gray-800 dark:text-gray-200">{item.message}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {item.timestamp.toLocaleString()}
            </p>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View in Explorer <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            )}
            {item.error && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (!transactionId) {
    return (
      <div className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
        No transaction in progress
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
        Transaction not found: {transactionId}
      </div>
    );
  }

  const statusItems = createStatusItems(transaction, events);
  const childStatusItems = childTx ? createStatusItems(childTx, childEvents) : [];
  const transactionTitle = transaction.type === TransactionType.COMMIT ? 'Commit Transaction' : 'Reveal Transaction';

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          {transactionTitle}
        </h2>
        {renderItems(statusItems)}
      </div>
      {childTx && (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
          <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Reveal Transaction</h3>
          {renderItems(childStatusItems)}
        </div>
      )}
    </div>
  );
};

export default TransactionStatusDisplay;
