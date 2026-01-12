/**
 * DID API Routes
 *
 * GET /api/auth/did - Get existing DID for authenticated user
 * POST /api/auth/did - Generate new DID or recover existing
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  generateEncryptedDID,
  recoverPrivateKey,
  verifyDID,
} from '@sync/shared';
import { getUserById, updateUser } from '@/lib/supabase/db';

/**
 * GET /api/auth/did
 * Get existing DID for authenticated user
 */
export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get user from Supabase
    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!user.did) {
      return NextResponse.json(
        { error: 'No DID generated for this user', code: 'DID_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      did: user.did,
      publicKey: user.did_public_key ? JSON.parse(user.did_public_key) : null,
    });
  } catch (error) {
    console.error('DID retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve DID',
        code: 'DID_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/did
 * Generate new DID or recover existing
 */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, oauthToken } = body;

    if (!oauthToken) {
      return NextResponse.json(
        { error: 'OAuth token required for DID operations', code: 'MISSING_TOKEN' },
        { status: 400 }
      );
    }

    // Get user from Supabase
    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (action === 'generate') {
      // Check if user already has a DID
      if (user.did) {
        return NextResponse.json(
          { error: 'User already has a DID', code: 'DID_EXISTS', did: user.did },
          { status: 409 }
        );
      }

      // Generate new DID
      const didData = await generateEncryptedDID(oauthToken);

      // Update user with DID in Supabase
      await updateUser(session.userId, {
        did: didData.did,
        did_public_key: JSON.stringify(didData.publicKey),
        did_encrypted_private_key: JSON.stringify({
          encryptedPrivateKey: didData.encryptedPrivateKey,
          salt: didData.salt,
          iv: didData.iv,
        }),
      });

      return NextResponse.json({
        success: true,
        did: didData.did,
        publicKey: didData.publicKey,
      });
    } else if (action === 'recover') {
      // Recover DID using OAuth token
      if (!user.did || !user.did_encrypted_private_key) {
        return NextResponse.json(
          { error: 'No DID found for recovery', code: 'DID_NOT_FOUND' },
          { status: 404 }
        );
      }

      try {
        // Parse the encrypted key data
        const keyData = JSON.parse(user.did_encrypted_private_key);

        // Attempt to decrypt private key with OAuth token
        const privateKey = await recoverPrivateKey(
          oauthToken,
          keyData.encryptedPrivateKey,
          keyData.salt,
          keyData.iv
        );

        // Verify the recovered key matches the stored public key
        const publicKey = user.did_public_key ? JSON.parse(user.did_public_key) : null;
        if (publicKey) {
          const isValid = await verifyDID(user.did, publicKey);
          if (!isValid) {
            return NextResponse.json(
              { error: 'DID verification failed', code: 'DID_INVALID' },
              { status: 400 }
            );
          }
        }

        return NextResponse.json({
          success: true,
          did: user.did,
          publicKey,
          privateKey, // Return for client to store locally
          message: 'DID recovered successfully',
        });
      } catch {
        return NextResponse.json(
          {
            error: 'Recovery failed - token may have changed',
            code: 'RECOVERY_FAILED',
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "generate" or "recover"', code: 'INVALID_ACTION' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('DID operation error:', error);
    return NextResponse.json(
      {
        error: 'DID operation failed',
        code: 'DID_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
