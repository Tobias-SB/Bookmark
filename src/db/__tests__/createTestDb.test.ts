import { createTestDb } from '../createTestDb';
import { describeDbContract } from '../testing/dbContract';

describeDbContract('createTestDb', async () => createTestDb());
