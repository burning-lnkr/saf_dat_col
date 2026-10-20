// Bounded source-bit reparse scorer. No image prior and no guessed dictionary bytes.
// CLI: score_candidates PROBLEM_DIR candidates.tsv scores.jsonl [max_blocks=1] [dump_dir]
// TSV (whitespace delimited): id N | id X bit [X bit ...] | id P start nbits hex_lsb
// P ranges may be repeated. Candidate author owns the source-faithfulness proof.
#include <algorithm>
#include <array>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;
static const int LB[29]={3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258};
static const int LE[29]={0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0};
static const int DB[30]={1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577};
static const int DE[30]={0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13};
struct Huff{
 int max=0;vector<int> table;
 Huff()=default;
 template<size_t N> explicit Huff(const array<int,N>& len){
  for(int n:len)max=std::max(max,n);if(!max)throw runtime_error("empty_huffman");
  array<int,16> count{},next{};for(int n:len)if(n)count[n]++;
  int code=0;for(int n=1;n<=max;n++){code=(code+count[n-1])*2;next[n]=code;}
  table.assign(1<<max,0);
  for(size_t s=0;s<N;s++)if(len[s]){int n=len[s],x=next[n]++,r=0;for(int j=0;j<n;j++){r=(r<<1)|(x&1);x>>=1;}
   for(int k=r;k<(int)table.size();k+=1<<n)table[k]=((s+1)<<5)|n;
  }
 }
};
struct Block{int id,start,body,end,synthetic;array<int,286>ll;array<int,30>dd;Huff lt,dt;};
struct Token{int p,L,D,S,bit,end,ds,block;};
struct Reader{
 const vector<uint8_t>& a;int pos,limit;
 int peek(int n)const{uint32_t x=0;int k=pos>>3;for(int j=0;j<4&&k+j<(int)a.size();j++)x|=uint32_t(a[k+j])<<(8*j);return (x>>(pos&7))&((1u<<n)-1);}
 int read(int n){if(pos+n>limit)throw runtime_error("read_past_retained_endpoint");int x=peek(n);pos+=n;return x;}
 int sym(const Huff& h){int x=h.table[peek(h.max)];if(!x)throw runtime_error("invalid_huffman_code");read(x&31);return (x>>5)-1;}
};
struct Stats{
 long long tokens=0,bytes=0,literals=0,matches=0,known=0,tested=0,knownCompared=0,unresolved=0,equal=0,equalKnown=0,equalSeed=0;
 long long cheaper=0,sameSymbol=0,saved=0,unavailable=0,largeD=0;
 int firstEndpoint=-1,firstCheaper=-1;
 void print(ostream& o)const{
  o<<"{\"data_tokens\":"<<tokens<<",\"output_bytes\":"<<bytes<<",\"literals\":"<<literals<<",\"matches\":"<<matches
   <<",\"known_output_bytes\":"<<known<<",\"tested\":"<<tested<<",\"known_endpoint_comparisons\":"<<knownCompared
   <<",\"unresolved_endpoint_comparisons\":"<<unresolved<<",\"endpoint_equalities\":"<<equal<<",\"equal_known\":"<<equalKnown
   <<",\"equal_same_seed\":"<<equalSeed<<",\"cheaper_absorptions\":"<<cheaper<<",\"same_symbol_absorptions\":"<<sameSymbol
   <<",\"saved_bits\":"<<saved<<",\"new_length_symbol_absent\":"<<unavailable<<",\"distance_gt32506\":"<<largeD
   <<",\"first_endpoint_bit\":"<<firstEndpoint<<",\"first_cheaper_bit\":"<<firstCheaper<<"}";
 }
};
struct Result{
 bool valid=true;string error;int errorBit=-1,errorBlock=-1,cut=0;vector<Token>t;vector<int32_t> tags;vector<Stats> by;
 Stats train,heldout;
 vector<array<int,286>> lf;vector<array<int,30>> df;
};
void accumulate(Stats& s,const vector<Token>&t,int i,int first,int last,const vector<int32_t>&a,const Block&b){
 const auto&k=t[i];if(!k.L)return;s.tokens++;s.bytes+=k.L;
 for(int j=0;j<k.L;j++)s.known+=a[32768+k.p+j]>=0;
 if(k.D){s.matches++;if(k.D>32506)s.largeD++;}else{s.literals++;return;}
 if(k.L>=258||i==first||i==last)return;
 int q=k.p+k.L,x=a[32768+q],y=a[32768+q-k.D];s.tested++;
 if(x>=0&&y>=0)s.knownCompared++;
 else if(x!=y)s.unresolved++;
 if(x!=y)return;
 s.equal++;if(x>=0)s.equalKnown++;else s.equalSeed++;
 if(s.firstEndpoint<0)s.firstEndpoint=k.bit;
 if(i+1>last||t[i+1].S>=256)return;
 int ns=257;while(ns<285&&LB[ns-256]<=k.L+1)ns++;
 if(!b.ll[ns]){s.unavailable++;return;}
 int save=b.ll[k.S]+LE[k.S-257]+b.ll[t[i+1].S]-b.ll[ns]-LE[ns-257];
 if(save>0){s.cheaper++;s.saved+=save;if(s.firstCheaper<0)s.firstCheaper=k.bit;}
 if(ns==k.S)s.sameSymbol++;
}
Result decode(const vector<uint8_t>&stream,const vector<Block>&blocks,int maxBlocks){
 Result r;r.tags.resize(32768);for(int j=0;j<32768;j++)r.tags[j]=j-32768;
 r.by.resize(maxBlocks);r.lf.resize(maxBlocks);r.df.resize(maxBlocks);r.cut=(blocks[0].body+blocks[0].end)/2;
 for(int bi=0;bi<maxBlocks;bi++){
  const auto&b=blocks[bi];Reader rd{stream,b.body,b.end};int first=r.t.size();
  try{
   while(true){
    int bit=rd.pos,p=r.tags.size()-32768,s=rd.sym(b.lt);r.lf[bi][s]++;
    if(s==256){r.t.push_back({p,0,0,s,bit,rd.pos,0,b.id});if(rd.pos!=b.end)throw runtime_error("eob_not_at_retained_endpoint");break;}
    if(s<256){if(p+1>16777216)throw runtime_error("bounded_output_limit");r.tags.push_back(s);r.t.push_back({p,1,0,s,bit,rd.pos,0,b.id});}
    else{
     if(s>285)throw runtime_error("invalid_length_symbol");int L=LB[s-257]+rd.read(LE[s-257]),ds=rd.sym(b.dt);
     if(ds>29)throw runtime_error("invalid_distance_symbol");int D=DB[ds]+rd.read(DE[ds]);r.df[bi][ds]++;
     if(D>p+32768)throw runtime_error("distance_beyond_initial_history");
     if(p+L>16777216)throw runtime_error("bounded_output_limit");
     r.t.push_back({p,L,D,s,bit,rd.pos,ds,b.id});
     for(int j=0;j<L;j++)r.tags.push_back(r.tags[r.tags.size()-D]);
    }
   }
  }catch(const exception&e){r.valid=false;r.error=e.what();r.errorBit=rd.pos;r.errorBlock=b.id;return r;}
  int last=(int)r.t.size()-2;
  for(int i=first;i<=last;i++){
   accumulate(r.by[bi],r.t,i,first,last,r.tags,b);
   if(bi==0)accumulate(r.t[i].bit<r.cut?r.train:r.heldout,r.t,i,first,last,r.tags,b);
  }
 }
 return r;
}
vector<uint8_t> readFile(const string&p){ifstream f(p,ios::binary);if(!f)throw runtime_error("Cannot read "+p);return vector<uint8_t>((istreambuf_iterator<char>(f)),{});}
void jsonResult(ostream&o,const string&id,const Result&r,int changedBits){
 o<<"{\"id\":"<<quoted(id)<<",\"valid\":"<<(r.valid?"true":"false")<<",\"changed_bits\":"<<changedBits
  <<",\"error\":"<<quoted(r.error)<<",\"error_bit\":"<<r.errorBit<<",\"error_block\":"<<r.errorBlock
  <<",\"tokens_including_eob\":"<<r.t.size()<<",\"output_bytes\":"<<r.tags.size()-32768<<",\"training_cut_bit\":"<<r.cut;
 if(r.valid){o<<",\"train\":";r.train.print(o);o<<",\"heldout_b1\":";r.heldout.print(o);o<<",\"blocks\":[";
  for(size_t b=0;b<r.by.size();b++){if(b)o<<',';o<<"{\"block\":"<<b+1<<",\"stats\":";r.by[b].print(o);o<<",\"ll_frequency\":[";
   for(int s=0;s<286;s++){if(s)o<<',';o<<r.lf[b][s];}o<<"],\"dd_frequency\":[";
   for(int s=0;s<30;s++){if(s)o<<',';o<<r.df[b][s];}o<<"]}";
  }o<<']';
 }o<<"}\n";
}
int main(int argc,char**argv){
 try{
  if(argc<4){cerr<<"Usage: score_candidates problem_dir cases.tsv scores.jsonl [max_blocks=1] [dump_dir]\n";return 2;}
  string dir=argv[1];vector<uint8_t> original=readFile(dir+"/stream.bin");ifstream m(dir+"/meta.txt");int n;m>>n;vector<Block>b(n);
  for(auto&x:b){m>>x.id>>x.start>>x.body>>x.end>>x.synthetic;for(int&v:x.ll)m>>v;for(int&v:x.dd)m>>v;x.lt=Huff(x.ll);x.dt=Huff(x.dd);}
  if(!m)throw runtime_error("invalid_meta");int maxBlocks=argc>4?stoi(argv[4]):1;if(maxBlocks<1||maxBlocks>n)throw runtime_error("invalid_block_count");
  ifstream cases(argv[2]);ofstream output(argv[3]);if(!cases||!output)throw runtime_error("Cannot open cases/results");string line;int count=0;
  if(argc>5)filesystem::create_directories(argv[5]);
  while(getline(cases,line)){
   if(line.empty()||line[0]=='#')continue;istringstream row(line);string id,op;row>>id;auto stream=original;
   while(row>>op){
    if(op=="N")continue;
    if(op=="X"){int bit;row>>bit;if(!row||bit<0||bit>=(int)stream.size()*8)throw runtime_error("invalid_xor_range");stream[bit>>3]^=1<<(bit&7);}
    else if(op=="P"){
     int start,len;string hex;row>>start>>len>>hex;if(!row||start<0||len<1||start+len>(int)stream.size()*8||(int)hex.size()!=2*((len+7)/8))throw runtime_error("invalid_replace_range");
     vector<uint8_t> rep;for(size_t j=0;j<hex.size();j+=2)rep.push_back(stoul(hex.substr(j,2),nullptr,16));
     for(int j=0;j<len;j++){int p=start+j,mask=1<<(p&7);stream[p>>3]=(stream[p>>3]&~mask)|(((rep[j>>3]>>(j&7))&1)<<(p&7));}
    }else throw runtime_error("unknown_patch_operator");
   }
   int changed=0;for(size_t j=0;j<stream.size();j++)changed+=__builtin_popcount(unsigned(stream[j]^original[j]));
   Result r=decode(stream,b,maxBlocks);jsonResult(output,id,r,changed);
   if(argc>5&&r.valid){
    string base=string(argv[5])+"/"+id;ofstream tg(base+".tags.i32",ios::binary),bytes(base+".bytes.bin",ios::binary),tokens(base+".tokens.tsv");
    tg.write(reinterpret_cast<const char*>(r.tags.data()+32768),(r.tags.size()-32768)*4);
    for(size_t j=32768;j<r.tags.size();j++){uint8_t v=r.tags[j]<0?0:r.tags[j];bytes.write(reinterpret_cast<char*>(&v),1);}
    tokens<<"block\tstart\tlength\tdistance\tsymbol\tbit\tend\tdsym\n";
    for(const auto&t:r.t)tokens<<t.block<<'\t'<<t.p<<'\t'<<t.L<<'\t'<<t.D<<'\t'<<t.S<<'\t'<<t.bit<<'\t'<<t.end<<'\t'<<t.ds<<'\n';
   }
   count++;if(count%100==0)cerr<<"scored "<<count<<" candidates\n";
  }
  cerr<<"complete "<<count<<" candidates\n";
 }catch(const exception&e){cerr<<e.what()<<'\n';return 1;}
}
