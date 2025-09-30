// Test script to demonstrate upsert functionality
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUpsert() {
  console.log('Testing upsert functionality...\n');

  const shop = 'test-shop.myshopify.com';
  const provider = 'facebook';

  try {
    // First upsert - should CREATE a new record
    console.log('1. First upsert (CREATE):');
    const result1 = await prisma.socialAccount.upsert({
      where: {
        shop_provider: {
          shop: shop,
          provider: provider
        }
      },
      update: {
        accessToken: 'updated-token-12345',
        updatedAt: new Date()
      },
      create: {
        shop: shop,
        provider: provider,
        accessToken: 'initial-token-12345',
        userId: 'facebook-user-123'
      }
    });
    console.log('Created:', result1);

    // Second upsert - should UPDATE the existing record
    console.log('\n2. Second upsert (UPDATE):');
    const result2 = await prisma.socialAccount.upsert({
      where: {
        shop_provider: {
          shop: shop,
          provider: provider
        }
      },
      update: {
        accessToken: 'updated-token-67890',
        updatedAt: new Date()
      },
      create: {
        shop: shop,
        provider: provider,
        accessToken: 'this-wont-be-used',
        userId: 'facebook-user-123'
      }
    });
    console.log('Updated:', result2);

    // Show all records
    console.log('\n3. All social accounts:');
    const allAccounts = await prisma.socialAccount.findMany();
    console.log(allAccounts);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUpsert();
