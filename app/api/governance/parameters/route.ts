import { NextResponse } from 'next/server';
import { createDefaultDaoParameters } from '../../../types';

interface MirrorNodeMessage {
  consensus_timestamp: string;
  message: string;
  sequence_number: number;
  running_hash: string;
  topic_id: string;
}

interface MirrorNodeResponse {
  messages: MirrorNodeMessage[];
}



export async function GET(): Promise<NextResponse> {
  try {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID || '0.0.6110234';

    console.log('API: Fetching DAO parameters from topic:', governanceTopicId);

    // Get mirror node base URL
    const mirrorNodeUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // Fetch messages from the governance topic
    const url = `${mirrorNodeUrl}/api/v1/topics/${governanceTopicId}/messages?order=desc&limit=10`;
    console.log('API: Fetching from URL:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('API: Mirror node request failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch from mirror node', details: `${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data: MirrorNodeResponse = await response.json();
    console.log('API: Retrieved messages:', {
      messageCount: data.messages?.length || 0,
      topicId: governanceTopicId
    });

    if (!data.messages || data.messages.length === 0) {
      console.log('API: No messages found in topic');
      return NextResponse.json(
        { error: 'No messages found in governance topic' },
        { status: 404 }
      );
    }

    // Process messages to find DAO parameters
    for (const message of data.messages) {
      try {
        // Decode base64 message
        const messageData = Buffer.from(message.message, 'base64').toString('utf-8');
        console.log('API: Analyzing message:', {
          sequence: message.sequence_number,
          timestamp: message.consensus_timestamp,
          messagePreview: messageData.substring(0, 100) + '...'
        });

        const parsed = JSON.parse(messageData);

        // Check if this is an HCS-10 message with reference
        if (parsed.p === 'hcs-10' && parsed.data?.startsWith('hcs://')) {
          console.log('API: Found HCS-10 reference:', parsed.data);
          
          try {
            // Use the basic HCS utility for simple message reading
            const { HCS } = await import('@hashgraphonline/standards-sdk');
            
            console.log('API: Using HCS utility to handle HCS-10 reference...');
            
            // Extract referenced topic ID (format: hcs://1/0.0.XXXXXX)
            const parts = parsed.data.split('/');
            const referencedTopicId = parts[parts.length - 1]; // Get the last part: 0.0.6110285
            
            console.log('API: Extracted referenced topic ID:', referencedTopicId);
            
            // Instantiate HCS and use retrieveHCS1Data to read the topic
            const hcs = new HCS();
            const referencedContent = await hcs.retrieveHCS1Data(referencedTopicId);
            
            console.log('API: Successfully retrieved content with HCS.retrieveHCS1Data:', {
              hasContent: !!referencedContent,
              contentType: typeof referencedContent,
              isBlob: referencedContent instanceof Blob,
              blobSize: referencedContent instanceof Blob ? referencedContent.size : 'N/A',
              blobType: referencedContent instanceof Blob ? referencedContent.type : 'N/A'
            });
            
            // Handle Blob content properly
            let actualContent: unknown = null;
            if (referencedContent instanceof Blob) {
              console.log('API: Reading Blob content...');
              const blobText = await referencedContent.text();
              console.log('API: Blob text length:', blobText.length);
              console.log('API: Blob text preview:', blobText.substring(0, 200) + '...');
              
              try {
                actualContent = JSON.parse(blobText);
                console.log('API: Successfully parsed Blob JSON content');
              } catch (parseError) {
                console.error('API: Failed to parse Blob content as JSON:', parseError);
                actualContent = blobText;
              }
            } else {
              actualContent = referencedContent;
            }
            
            // Check if this contains DAO parameters (nested in data field for HCS-10 format)
            const contentObj = actualContent as Record<string, unknown>;
            const dataObj = contentObj?.data as Record<string, unknown>;
            
            console.log('API: Final content structure:', {
              hasActualContent: !!actualContent,
              actualContentType: typeof actualContent,
              actualContentKeys: typeof actualContent === 'object' ? Object.keys(actualContent || {}) : 'Not an object',
              hasData: !!(contentObj?.data),
              dataKeys: dataObj ? Object.keys(dataObj) : 'No data field',
              hasParameters: !!(dataObj?.parameters),
              hasRebalancing: !!(dataObj?.parameters as Record<string, unknown>)?.rebalancing,
              hasTreasury: !!(dataObj?.parameters as Record<string, unknown>)?.treasury
            });
            const daoData = dataObj?.parameters || dataObj;
            const daoDataObj = daoData as Record<string, unknown>;
            if (daoData && (daoDataObj.parameters || daoDataObj.rebalancing || daoDataObj.treasury)) {
              console.log('API: Found DAO parameters via HCS utility!');
              
              return NextResponse.json({
                parameters: daoDataObj.parameters || daoData,
                metadata: {
                  timestamp: message.consensus_timestamp,
                  sequenceNumber: message.sequence_number,
                  version: (dataObj?.metadata as Record<string, unknown>)?.version || '1.0.0',
                  sourceTopicId: governanceTopicId,
                  decodedWithHCS: true,
                  hcsReference: parsed.data
                }
              });
            }
            
          } catch (hcsError) {
            console.error('API: Failed with HCS utility:', hcsError);
            // Continue with fallback logic below
          }
        }
        
        // Check if this message directly contains DAO parameters
        if (parsed.parameters || parsed.rebalancing || parsed.treasury) {
          console.log('API: Found direct DAO parameters');
          
          return NextResponse.json({
            parameters: parsed.parameters || parsed,
            metadata: {
              timestamp: message.consensus_timestamp,
              sequenceNumber: message.sequence_number,
              version: parsed.metadata?.version || '1.0.0',
              sourceTopicId: governanceTopicId
            }
          });
        }

      } catch (parseError) {
        console.log('API: Could not parse message as JSON:', {
          sequence: message.sequence_number,
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
        continue;
      }
    }

    console.log('API: No DAO parameters found in any messages, returning defaults');
    
    // Return default parameters if none found
    return NextResponse.json({
      parameters: createDefaultDaoParameters(),
      metadata: {
        timestamp: new Date().toISOString(),
        sequenceNumber: 0,
        version: '1.0.0-default',
        sourceTopicId: 'default'
      }
    });

  } catch (error) {
    console.error('API: Error fetching governance parameters:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 