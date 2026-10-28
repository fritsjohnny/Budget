import { Injectable } from '@angular/core';
import {
  C6StatementPreview,
  CardStatementDescriptionAlias,
  CardStatementReconciliationMatchInput,
} from 'src/app/models/cardstatement.model';

export interface CardStatementReconciliationDraft {
  cardId: number;
  reference: string;
  fileName: string;
  zipBlob?: Blob;
  zipBytes?: ArrayBuffer;
  preview?: C6StatementPreview;
  manualMatches: Record<string, number>;
  pendingMatches?: Record<string, CardStatementReconciliationMatchInput>;
  pendingAliases?: Record<string, { alias: CardStatementDescriptionAlias; postingId: number }>;
  savedAt: string;
}

type StoredDraft = CardStatementReconciliationDraft & { key: string };

@Injectable({ providedIn: 'root' })
export class CardStatementReconciliationDraftService {
  private readonly databaseName = 'budget-card-statement-drafts';
  private readonly storeName = 'reconciliation-drafts';
  private readonly zipStoreName = 'reconciliation-zip-files';
  private databasePromise?: Promise<IDBDatabase>;
  private persistenceRequest?: Promise<void>;

  load(cardId: number, reference: string): Promise<CardStatementReconciliationDraft | undefined> {
    const key = this.key(cardId, reference);
    return this.openDatabase().then(database => new Promise<CardStatementReconciliationDraft | undefined>((resolve, reject) => {
      const transaction = database.transaction([this.storeName, this.zipStoreName], 'readonly');
      const draftRequest = transaction.objectStore(this.storeName).get(key) as IDBRequest<StoredDraft | undefined>;
      const zipRequest = transaction.objectStore(this.zipStoreName).get(key) as IDBRequest<ArrayBuffer | undefined>;
      let draft: StoredDraft | undefined;
      let zipBytes: ArrayBuffer | undefined;

      draftRequest.onsuccess = () => draft = draftRequest.result;
      zipRequest.onsuccess = () => zipBytes = zipRequest.result;
      draftRequest.onerror = () => reject(draftRequest.error ?? new Error('Falha ao ler o rascunho da conferência.'));
      zipRequest.onerror = () => reject(zipRequest.error ?? new Error('Falha ao ler o ZIP salvo.'));
      transaction.oncomplete = () => {
        if (!draft) {
          resolve(undefined);
          return;
        }

        resolve({
          ...draft,
          zipBytes: zipBytes ?? draft.zipBytes,
        });
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao ler a conferência local.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('A leitura local da conferência foi cancelada.'));
    }));
  }

  save(draft: CardStatementReconciliationDraft, includeZip: boolean): Promise<void> {
    const zipBytesPromise = includeZip
      ? this.readZipBytes(draft)
      : Promise.resolve(undefined);

    return Promise.all([this.requestPersistentStorage(), this.openDatabase(), zipBytesPromise])
      .then(([, database, zipBytes]) => new Promise<void>((resolve, reject) => {
        const key = this.key(draft.cardId, draft.reference);
        const transaction = database.transaction([this.storeName, this.zipStoreName], 'readwrite');
        const draftStore = transaction.objectStore(this.storeName);
        const metadata = { ...draft };
        delete metadata.zipBlob;
        delete metadata.zipBytes;

        draftStore.put({
          ...metadata,
          key,
          savedAt: new Date().toISOString(),
        } as StoredDraft);

        if (includeZip && zipBytes) {
          transaction.objectStore(this.zipStoreName).put(zipBytes, key);
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao salvar a conferência local.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('A gravação local da conferência foi cancelada.'));
      }));
  }

  remove(cardId: number, reference: string): Promise<void> {
    const key = this.key(cardId, reference);
    return this.openDatabase().then(database => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([this.storeName, this.zipStoreName], 'readwrite');
      transaction.objectStore(this.storeName).delete(key);
      transaction.objectStore(this.zipStoreName).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao apagar a conferência local.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('A remoção da conferência local foi cancelada.'));
    }));
  }

  private key(cardId: number, reference: string): string {
    return `${cardId}:${reference}`;
  }

  private readZipBytes(draft: CardStatementReconciliationDraft): Promise<ArrayBuffer> {
    if (draft.zipBytes) return Promise.resolve(draft.zipBytes);
    if (draft.zipBlob) return draft.zipBlob.arrayBuffer();
    return Promise.reject(new Error('O arquivo ZIP não está disponível para salvar.'));
  }

  private requestPersistentStorage(): Promise<void> {
    if (this.persistenceRequest) return this.persistenceRequest;

    this.persistenceRequest = Promise.resolve().then(() => {
      if (typeof navigator === 'undefined') return;

      const storage = (navigator as Navigator & {
        storage?: { persist?: () => Promise<boolean> };
      }).storage;
      return storage?.persist?.().then(() => undefined);
    }).catch(() => undefined);

    return this.persistenceRequest;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(this.zipStoreName)) {
          database.createObjectStore(this.zipStoreName);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          this.databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('O armazenamento local não está disponível.'));
      request.onblocked = () => reject(new Error('Feche outras janelas do Budget para acessar o rascunho da conferência.'));
    }).catch(error => {
      this.databasePromise = undefined;
      throw error;
    });

    return this.databasePromise;
  }
}
