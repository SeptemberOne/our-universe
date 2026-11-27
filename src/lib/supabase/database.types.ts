export type PreferredLanguage = 'en' | 'zh-CN';
export type CoupleMemberRole = 'creator' | 'partner';
export type CoupleInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          preferred_language: PreferredLanguage;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          preferred_language?: PreferredLanguage;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          preferred_language?: PreferredLanguage;
          updated_at?: string;
        };
        Relationships: [];
      };
      couples: {
        Row: {
          id: string;
          title: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      couple_members: {
        Row: {
          couple_id: string;
          user_id: string;
          member_slot: 1 | 2;
          role: CoupleMemberRole;
          joined_at: string;
        };
        Insert: {
          couple_id: string;
          user_id: string;
          member_slot: 1 | 2;
          role: CoupleMemberRole;
          joined_at?: string;
        };
        Update: {
          couple_id?: string;
          user_id?: string;
          member_slot?: 1 | 2;
          role?: CoupleMemberRole;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'couple_members_couple_id_fkey';
            columns: ['couple_id'];
            isOneToOne: false;
            referencedRelation: 'couples';
            referencedColumns: ['id'];
          },
        ];
      };
      couple_invitations: {
        Row: {
          id: string;
          couple_id: string;
          invited_by: string;
          status: CoupleInvitationStatus;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          invited_by: string;
          token_hash: string;
          status?: CoupleInvitationStatus;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: CoupleInvitationStatus;
          accepted_by?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'couple_invitations_couple_id_fkey';
            columns: ['couple_id'];
            isOneToOne: false;
            referencedRelation: 'couples';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_couple_space: {
        Args: {
          p_title?: string;
        };
        Returns: string;
      };
      create_couple_invitation: {
        Args: {
          p_ttl_hours?: number;
        };
        Returns: {
          invitation_id: string;
          invite_token: string;
          expires_at: string;
        }[];
      };
      accept_couple_invitation: {
        Args: {
          p_invite_token: string;
        };
        Returns: string;
      };
      revoke_couple_invitation: {
        Args: {
          p_invitation_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
